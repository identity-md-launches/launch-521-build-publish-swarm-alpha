#!/usr/bin/env python3
"""Read-only IMD directory snapshot. Uses only Python's standard library.

API contracts: https://imd.fun/docs/#pagination and #publications
Run from the repository root: python3 scripts/collect-data.py
Never replaces a good snapshot when collection is incomplete.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import argparse
import json
from pathlib import Path
import time
import urllib.parse
import urllib.request

API = 'https://api.imd.fun'
DEST = Path('public/data/snapshot.json')
SCRATCH = Path('test/scratch/collector-cache')
SCRATCH.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument('--use-cache', action='store_true', help='Reuse this run\'s public response cache for interrupted collection.')
args = parser.parse_args()
errors = []

def fetch(path):
    cached = SCRATCH / (urllib.parse.quote(path, safe='') + '.json')
    if args.use_cache and cached.exists():
        return json.loads(cached.read_text())
    for attempt in range(3):
        try:
            request = urllib.request.Request(API + path, headers={'User-Agent': 'SwarmAlpha-PublicDirectory/1.0'})
            with urllib.request.urlopen(request, timeout=25) as response:
                result = json.load(response)
            cached.write_text(json.dumps(result))
            return result
        except Exception as exc:
            if attempt == 2:
                raise RuntimeError(f'{path}: {exc}') from exc
            time.sleep(0.3 * (attempt + 1))

def clean(value):
    if isinstance(value, dict):
        return {key: clean(item) for key, item in value.items() if item is not None and item != [] and item != {}}
    if isinstance(value, list):
        return [clean(item) for item in value]
    return value

def pick(record, keys):
    return {key: record[key] for key in keys.split() if key in record and record[key] is not None}

def paginate(resource):
    rows, pages, before = [], 0, None
    ids = set()
    while True:
        path = f'/{resource}?limit=500' + ('&before=' + urllib.parse.quote(before) if before else '')
        response = fetch(path)
        page = response[resource]
        pages += 1
        if any(row['id'] in ids for row in page):
            raise RuntimeError(f'{resource} pagination did not advance; good snapshot preserved')
        rows.extend(page)
        ids.update(row['id'] for row in page)
        if len(page) < 500:
            break
        before = min(row['createdAt'] for row in page)
    print(f'{resource}: {len(rows)} records / {pages} pages', flush=True)
    return rows, {'fetched': len(rows), 'pages': pages, 'complete': True, 'pagination': 'limit=500; before=oldest createdAt; final page < 500', 'oldest': min(row['createdAt'] for row in rows)}

cache_times = [path.stat().st_mtime for path in SCRATCH.glob('*.json')] if args.use_cache else []
checked_at = (datetime.fromtimestamp(min(cache_times), timezone.utc) if cache_times else datetime.now(timezone.utc)).isoformat(timespec='seconds').replace('+00:00', 'Z')
all_jobs, job_coverage = paginate('jobs')
workflows, workflow_coverage = paginate('workflows')
latest_sites = fetch('/sites')
publications = []
page = 1
while True:
    result = fetch(f'/publications?type=sites&page={page}&pageSize=100')
    publications.extend(result['items'])
    if page >= result['totalPages']:
        break
    page += 1
sites = {row['id']: row for row in latest_sites['sites']}
for publication in publications:
    for site in publication['sites']:
        sites.setdefault(site['id'], site)
site_ids = list(sites)
with ThreadPoolExecutor(max_workers=8) as pool:
    for site_id, site in zip(site_ids, pool.map(lambda ident: fetch('/sites/' + ident), site_ids)):
        # The individual endpoint is the authoritative full record.
        sites[site_id] = site.get('site', site)
        sites[site_id]['sourceUrl'] = API + '/sites/' + site_id

# Retrieve every workflow detail, preserving explicit network and contract handoffs.
workflow_summaries = {row['id']: row for row in workflows}
with ThreadPoolExecutor(max_workers=8) as pool:
    workflow_details = list(pool.map(lambda row: fetch('/workflows/' + row['id']), workflows))
workflows_out = []
for detail in workflow_details:
    item = pick(detail, 'id objective status failure chainId createdAt updatedAt contracts frontend launch validation site')
    handoff = detail.get('handoff') or {}
    item['handoff'] = pick(handoff, 'chainId repoUrl launchId contracts')
    item['sourceUrl'] = API + '/workflows/' + detail['id']
    item['originalRequest'] = detail.get('objective')
    item.pop('objective', None)
    workflows_out.append(clean(item))

linked_ids = {row['jobId'] for row in sites.values() if row.get('jobId')}
for row in workflows:
    linked_ids.update(row[key] for key in ('contractsJobId', 'frontendJobId') if row.get(key))
for publication in publications:
    for version in publication.get('versions', []):
        if version.get('jobId'):
            linked_ids.add(version['jobId'])
    if publication['id'].startswith('job:'):
        linked_ids.add(publication['id'].split(':', 1)[1])
job_details = {}
# Follow only explicit parent relations, without grouping by similar names.
while linked_ids - job_details.keys():
    batch = sorted(linked_ids - job_details.keys())
    with ThreadPoolExecutor(max_workers=8) as pool:
        for job_id, detail in zip(batch, pool.map(lambda ident: fetch('/jobs/' + ident), batch)):
            job_details[job_id] = detail
            if detail.get('parentJobId'):
                linked_ids.add(detail['parentJobId'])

def compact_project(project):
    if not project:
        return None
    result = pick(project, 'id head')
    result['versions'] = [pick(version, 'jobId workflowId state repoUrl commit createdAt site') for version in project.get('versions', [])]
    return clean(result)

jobs_out = {row['id']: clean(row) for row in all_jobs if 'oracle' not in row.get('template', '')}
for row in jobs_out.values():
    if row.get('project'):
        row['project'] = compact_project(row['project'])
for job_id, detail in job_details.items():
    row = pick(detail, 'id state template blockedReason createdAt updatedAt parentJobId project deliver host delivery')
    row['project'] = compact_project(row.get('project'))
    row['sourceUrl'] = API + '/jobs/' + job_id
    row['workflowId'] = (detail.get('workflow') or {}).get('id')
    if detail.get('site'):
        row['siteId'] = detail['site']['id']
    # Workflow frontend context repeats the complete contract handoff; the user's
    # original workflow request is stored on the workflow instead.
    objective = detail.get('objective', '')
    row['objective'] = objective[:220] + ('…' if len(objective) > 220 else '')
    if not row.get('workflowId'):
        row['originalRequest'] = objective
    row['nodes'] = [clean(pick(node, 'key role state attempt updatedAt verdict seat')) for node in detail.get('nodes', [])]
    row['reviews'] = [clean(pick(review, 'status chainId txHash blockNumber sentAt entries')) for review in detail.get('reviews', [])]
    jobs_out[job_id] = clean(row)

publications_out = []
for publication in publications:
    row = pick(publication, 'id publishedAt release types')
    row['siteIds'] = [site['id'] for site in publication['sites']]
    row['versions'] = [clean(pick(version, 'jobId state repoUrl commit createdAt site')) for version in publication.get('versions', [])]
    row['title'] = publication.get('title', '')[:220]
    publications_out.append(clean(row))

# Record the public seat profile response and timestamp; do not call API ownership
# data an independent on-chain verification.
token_ids = {node['seat']['tokenId'] for job in jobs_out.values() for node in job.get('nodes', []) if node.get('seat', {}).get('tokenId')}
for site in sites.values():
    if site.get('tokenId'):
        token_ids.add(str(site['tokenId']))
def seat_profile(token):
    try:
        response = fetch(f'/seats/{token}?work=0&reviews=0&collaborators=0')
        return token, response
    except RuntimeError as exc:
        errors.append(str(exc))
        return token, None
seats = []
with ThreadPoolExecutor(max_workers=8) as pool:
    for token, detail in pool.map(seat_profile, sorted(token_ids)):
        if detail:
            seats.append({'tokenId': token, 'checkedAt': checked_at, 'sourceUrl': API + '/seats/' + token, 'profile': clean(detail)})

def check_site(site):
    url = site.get('url')
    if not url or urllib.parse.urlsplit(url).scheme not in ('https', 'http'):
        return {'status': 'not-checked', 'reason': 'No HTTP website URL', 'checkedAt': checked_at}
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'SwarmAlpha-PublicDirectory/1.0'})
        with urllib.request.urlopen(request, timeout=6) as response:
            response.read(1024)
            return {'status': 'reachable', 'httpStatus': response.status, 'finalUrl': response.url, 'checkedAt': datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'), 'scope': 'HTTP GET entrypoint only; features not tested'}
    except Exception as exc:
        return {'status': 'unreachable', 'reason': str(exc)[:150], 'checkedAt': datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'), 'scope': 'One HTTP GET from the collection environment; not proof of removal'}
with ThreadPoolExecutor(max_workers=12) as pool:
    for site, result in zip(sites.values(), pool.map(check_site, sites.values())):
        site['linkCheck'] = result
print('Site link checks complete', flush=True)

site_coverage = {'fetched': len(sites), 'total': latest_sites['total'], 'live': latest_sites.get('live'), 'pages': page, 'complete': len(sites) == latest_sites['total'], 'publicationItems': len(publications), 'pagination': '/sites latest100 plus every /publications?type=sites&page=N&pageSize=100, resolved with /sites/:id'}
if not site_coverage['complete']:
    raise RuntimeError(f'Site coverage is incomplete {len(sites)}/{latest_sites["total"]}; good snapshot preserved')
columns = ['id', 'state', 'template', 'createdAt', 'updatedAt']
snapshot = {'schemaVersion': 1, 'checkedAt': checked_at, 'apiBase': API, 'documentationUrl': 'https://imd.fun/docs/', 'coverage': {'sites': site_coverage, 'jobs': job_coverage, 'workflows': workflow_coverage}, 'limitations': ['This is a timestamped public API snapshot, not a guarantee of future coverage.', 'The jobs endpoint returns shortened objectives in list responses. Complete project requests are retained for site-linked jobs and workflows.', 'The compact jobIndex preserves all fetched job IDs, states, templates and timestamps; unrelated oracle-job request text is omitted to keep the static export small.', 'Owner fields are public API observations at checkedAt; they are not an independently performed ownerOf call.', 'Publication and structural acceptance do not establish feature correctness or financial safety.', 'Creation-time pagination is exclusive; equal-timestamp boundary records could be missed if the upstream API returns a full page with tied timestamps.'], 'sites': [clean(row) for row in sites.values()], 'jobs': list(jobs_out.values()), 'jobIndexColumns': columns, 'jobIndex': [[row.get(key) for key in columns] for row in all_jobs], 'workflows': workflows_out, 'publications': publications_out, 'seats': seats, 'collectionWarnings': errors}
DEST.parent.mkdir(parents=True, exist_ok=True)
payload = json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')) + '\n'
temporary = DEST.with_suffix('.json.tmp')
temporary.write_text(payload)
temporary.replace(DEST)
print(f'Saved {DEST}: {len(payload.encode())} bytes; {len(sites)} sites, {len(jobs_out)} expanded/non-oracle jobs, {len(seats)} seats', flush=True)
