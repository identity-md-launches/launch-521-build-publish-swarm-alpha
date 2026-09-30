#!/usr/bin/env python3
"""Check export integrity and a conservative, uncompressed submission path budget."""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parent.parent
BUDGET = 8_388_608
ROOT_FILES = ['README.md', 'DESIGN.md', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.mjs']
DIRECTORIES = ['src', 'public', 'dist', 'scripts', 'artifacts', 'test']
files = [ROOT / p for p in ROOT_FILES]
for directory in DIRECTORIES:
    for path in (ROOT / directory).rglob('*'):
        if 'scratch' in path.relative_to(ROOT).parts:
            continue
        assert not path.is_symlink(), f'Symlink/submodule-like artifact: {path}'
        if path.is_file():
            assert not any(x in path.parts for x in ['node_modules', '__pycache__', '.cache', '.npm', '.vite']), f'Generated directory: {path}'
            assert path.suffix not in ['.tgz', '.pyc', '.map'], f'Unnecessary packaging/cache asset: {path}'
            files.append(path)
for path in files:
    assert path.is_file(), f'Missing deliverable: {path}'
html = (ROOT / 'dist/index.html').read_text()
for asset in re.findall(r'(?:src|href)="([^"]+)"', html):
    if asset.startswith('data:'):
        continue
    assert asset.startswith('./'), f'Non-relative entrypoint asset: {asset}'
    assert (ROOT / 'dist' / asset).is_file(), f'Missing asset: {asset}'
for name in ['snapshot.json', 'featured.json']:
    source = ROOT / 'public/data' / name
    output = ROOT / 'dist/data' / name
    assert source.read_bytes() == output.read_bytes(), f'Stale production data: {name}'
for feature in json.loads((ROOT / 'public/data/featured.json').read_text()):
    for asset in [feature.get('logo'), *(a.get('avatar') for a in feature.get('agents', []))]:
        if asset and asset.startswith('./'):
            assert (ROOT / 'dist' / asset).is_file(), f'Missing local image: {asset}'
snapshot = json.loads((ROOT / 'dist/data/snapshot.json').read_text())
assert len(snapshot['sites']) == snapshot['coverage']['sites']['total']
assert len({s['id'] for s in snapshot['sites']}) == len(snapshot['sites'])
size = sum(p.stat().st_size for p in files)
assert size < BUDGET, f'Submission content exceeds budget: {size}'
result = {
    'status': 'pass', 'files': len(files), 'uncompressedSubmissionBytes': size,
    'limitBytes': BUDGET, 'headroomBytes': BUDGET-size,
    'productionBytes': sum(p.stat().st_size for p in (ROOT/'dist').rglob('*') if p.is_file()),
    'siteRecords': len(snapshot['sites']),
    'indexSha256': hashlib.sha256((ROOT/'dist/index.html').read_bytes()).hexdigest(),
    'scope': 'Complete enumerated source/export/documentation paths; excludes supplied inputs, environment metadata, .git and disposable test/scratch. No Git metadata was modified.'
}
print(json.dumps(result, indent=2))
