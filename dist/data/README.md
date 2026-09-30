# Snapshot provenance

The bundled `snapshot.json` was collected from the unauthenticated public API at `https://api.imd.fun`, beginning **2026-09-30 20:25:38 UTC**. It contains public observations, not an independent audit. `featured.json`, when present, adds separately sourced editorial research; it does not modify API site records.

Run `python3 scripts/collect-data.py` from the repository root to replace the snapshot after a successful collection. The collector uses Python's standard library, performs no writes to remote systems, requires no credentials, and retains an existing snapshot if required endpoint collection fails or site coverage is incomplete. Its optional `--use-cache` resumes public responses stored in disposable `test/scratch/collector-cache/`; this directory is not a deliverable. Cache reuse retains the earliest response timestamp instead of claiming a fresh API observation.

## Coverage and pagination

- **151 of 151 API site records** recovered. `/sites` is documented as newest 100, and does not offer site-list pagination. The collector therefore requests every page of `/publications?type=sites&page=N&pageSize=100` (2 pages, 145 publication items), unions all embedded site IDs with `/sites`, and resolves each using `/sites/:id`. The recovered count equals the contemporaneous site API total.
- **5,163 job records** collected through 11 pages of `/jobs?limit=500&before=OLDEST_CREATED_AT`, continuing until the final page has fewer than 500 records. All are retained in the compact `jobIndex`, whose tuple columns are explicitly given by `jobIndexColumns`. `jobs` retains 627 non-oracle summaries, expanding all site/workflow-linked jobs and recursively following explicit `parentJobId` references. Unrelated oracle-job request prose is omitted to reduce payload size; no fetched job ID is omitted from the index.
- **124 workflows** collected with the same supported cursor scheme (one page below the maximum of 500). Every workflow detail endpoint was retrieved, preserving its original request, source repository, network, declared deployed contracts, and validation scope.
- **100 public NFT seat profiles** were read for participant IDs appearing in the expanded jobs. Ownership is an API-reported observation, with source and observation time. It is not claimed as an independently repeated onchain `ownerOf` verification.

Pagination follows the published API documentation at <https://imd.fun/docs/#pagination> and <https://imd.fun/docs/#publications>. Exclusive timestamp cursors cannot independently establish the absence of undisclosed records sharing a page boundary timestamp. These totals describe this collection time, not all future or unpublished projects.

## Identity and history

`site.supersededBy`, `job.parentJobId`, `job.project.id/head/versions`, and explicit `publication.siteIds/versions` are source-provided links. Only these kinds of links may support version grouping. Similar names, domains, purposes, or requests do not establish a shared project. Full workflow requests are stored once in `workflow.originalRequest`; workflow-stage jobs reference `workflowId` instead of repeating their generated handoff. Other expanded jobs retain their original request. Duplicated version prose is omitted, while version IDs, sources, commits and confirmed timestamps remain available.

The site records have 148 `named` statuses, 3 failed publications, and 9 explicit superseded records. The upstream `live` field is 139. A named record describes publication state; it does not prove that its entrypoint is reachable, that features work, or that its contracts are safe. API site records are all `kind: launch` in this snapshot. External projects requested for inclusion must be separately labelled; they must not inflate the count of discovered API records.

## Link and verification scope

The collector made one HTTP GET against each available named website, reading only the first 1,024 response bytes. Each result stores its own time, HTTP status when returned, and scope. Results were **17 reachable, 131 unreachable from this collection environment, and 3 with no HTTP website URL**. A failure does not establish that a site was removed: gateway/network availability can differ by location and time. Content identifiers are preserved so the interface can offer immutable IPFS alternatives. No JavaScript, wallet interaction or financial transaction was executed by these link checks.

All 124 workflow chain IDs in this snapshot are **11155111 (Sepolia testnet)**. Contract addresses are taken from the API deployment handoff, with transaction hashes when available; these are not automatically Ethereum mainnet addresses. The workflows' validation reports retain their precise scope and check times. Their checks explicitly exclude browser feature testing and financial safety.

## Local integrity validation

`test/scratch/test_snapshot.py` was run successfully against the finished snapshot: unique IDs, all-site total reconciliation, all-job index coverage, pagination termination metadata, explicit relationship preservation, retained original requests, safe public source URLs, chain IDs, link-check counts, and collector Python syntax. These assertions check internal consistency; they do not independently certify upstream data accuracy.
