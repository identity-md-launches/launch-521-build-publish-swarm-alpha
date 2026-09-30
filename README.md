# SWARM ALPHA

A React + TypeScript directory of IdentityMD projects with a production static export in `dist/`. It works without an account, wallet, backend, frontend secret or runtime package download. Vite uses `base: './'`; navigation uses URL fragments, including `#/project/pepe2pepe`, so the same export works under an IPFS gateway subpath.

**Delivery status:** the working local export, source, lockfile, tests and design documentation are present. The exact brand Pepe attachment was absent from the supplied inputs and has been requested; no substitute logo or face favicon was invented. Remote repository creation and public hosting are **not completed**: no destination or publishing integration was supplied, and the public job API still reported `delivery: null` and `site: null` during this run. Do not describe the local preview as a published website.

## Install, develop, preview and rebuild

Requires Node.js 22 (validated with 22.22.1) and npm. From a normal development checkout:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run preview -- --host 127.0.0.1
```

Open the URL printed by Vite. `npm run dev` starts source development. `npm run build` replaces `dist/`; publish the **entire directory**, including `assets/`, `data/`, `logos/` and `fonts/`. Do not publish only `index.html`. Static hosting needs an HTTP server; opening an HTML file with `file://` will not reliably load the JSON snapshot.

For a workspace that forbids a local dependency directory, the configuration supports an external installation. The worker used `/tmp/swarm-alpha-deps` (not part of the submission):

```sh
# Use a disposable directory of your choosing; copy the delivered manifest and lockfile there.
mkdir -p /tmp/swarm-alpha-deps
cp package.json package-lock.json /tmp/swarm-alpha-deps/
npm ci --prefix /tmp/swarm-alpha-deps
SWARM_DEPENDENCIES=/tmp/swarm-alpha-deps npm run typecheck
/tmp/swarm-alpha-deps/node_modules/.bin/tsx --test test/*.test.ts
SWARM_DEPENDENCIES=/tmp/swarm-alpha-deps /tmp/swarm-alpha-deps/node_modules/.bin/vite build
```

No package-manager cache, dependency directory, registry mirror, tarball or submodule belongs in the submission. No ignore file was created or changed (ignore-path budget: **0 bytes**). Dependencies and caches were installed outside this repository. `test/scratch/` contains disposable checks and is not required to build or run the site.

## Change the brand

Edit `src/config.ts` to change the name, tagline, approved logo path and favicon path. The page title and visible brand use that configuration. After the original Pepe attachment is supplied, preserve its appearance, remove the background, place its transparent full image and face crop under `public/brand/`, set the two paths and rebuild. The empty favicon currently suppresses an unnecessary browser request; it is not a replacement brand image.

The brand prefers **Comic Sans MS** on systems where it is available. The browser used here does not have that proprietary font. A bundled, OFL-licensed Comic Neue 700 is the explicit fallback; the body uses a system sans-serif stack. No claim is made that Comic Neue is Comic Sans MS. See `DESIGN.md` for the implemented system and this limitation.

## Data and evidence

The timestamped snapshot begins at **2026-09-30 20:25:38 UTC** and preserves:

- 151/151 discovered API site records, including nine old versions and three failed publications;
- all 5,163 collected jobs in a compact index, with 627 relevant/non-oracle summaries and expanded site/workflow evidence;
- 124 workflows and 100 public NFT profiles;
- 141 explicitly reconciled registry project groups, plus the two requested external projects, HIVE and Pepe2Pepe. These 143 groups are **not a count of unique active projects**.

`/sites` has a documented newest-100 limit. The collector follows every supported `/publications?type=sites&page=N&pageSize=100` page and resolves the recovered IDs through `/sites/:id`. Jobs and workflows use the supported `limit=500&before=...` cursor until exhausted. Similar names or domains never establish version grouping. Full original requests, old links, work-role attribution and deployed-network evidence remain inspectable.

The browser attempts an atomic live refresh and includes a Refresh data button. On CORS, HTTP, malformed-page, timeout or incomplete-history failures it retains the complete last valid snapshot. **Real preview requests to `/jobs` and `/workflows` were blocked by the API's CORS policy.** The fallback works; successful live refresh was tested with complete paginated mock responses, not claimed as observed against the live browser API. Use the collector to produce a newer static snapshot when browser access remains blocked:

```sh
python3 scripts/collect-data.py
npm run build
```

The collector uses only Python's standard library. It replaces the snapshot only after complete required collection. Rebuilding does not automatically re-research featured project claims; update `public/data/featured.json` with source and check time when evidence changes.

See `public/data/README.md` for collection methods and limits, `artifacts/featured-research.md` for HIVE/Pepe2Pepe chain and owner checks, and the site's About the data page for label meanings. Generic project features have an explicit unverified assessment; a complete independent promise-by-promise feature audit of every site has not been performed. No safety scores are fabricated. Reachability, publication, build acceptance and tested functionality are separate facts.

## Validation actually performed

The final production build and strict TypeScript check passed. `python3 scripts/check-export.py` checks relative entrypoint assets, matching source/export snapshots, required logos, complete site counts and the conservative uncompressed submission budget. The final Node test run passed **21 assertions/subtests** covering reconciliation, search, networks, missing values, ownership attribution and atomic refresh behavior. The production export was served at `/preview/`, and **43 Playwright assertions** passed for the primary interactions, including themes, normalized URL/NFT/agent/contract search, filters, sorting, both paginations, hash routes, copy buttons, keyboard focus and snapshot retention on the actual CORS failure.

Home and details had no horizontal overflow at 320, 390, 834 and 1440 CSS pixels. Screenshots were inspected at desktop and mobile sizes. Axe checks and measured contrast results, resolved Better Interface findings, final screenshots, remaining checks and actual execution details are in `artifacts/validation.md`. These are worker observations, not independent certification. Screen-reader sessions, native browser zoom and physical-device tests were not performed.

The reusable `test/browser-validation.js` is an async Playwright page function. Load it in a Playwright tool or harness with a page already open on the production preview. It assumes the saved theme starts light and includes a final assertion for the CORS fallback observed in this environment; change that expectation if API CORS policy changes.

## Publish the static export

1. Rebuild and run the checks above after any final changes. Supply the missing approved brand image before declaring branding complete.
2. Submit the source, manifest/lockfile, `DESIGN.md`, this README, `artifacts/`, tests, collector and **all of `dist/`** to the chosen repository. The assignment forbade modifying `.git/`, so the worker did not create commits or remotes.
3. Upload the contents of `dist/` to a static host, or add the directory recursively to IPFS and pin the resulting CID. No SPA rewrite rule is needed for hash routes. For a gateway the entrypoint is `/ipfs/<actual-CID>/`; obtain the real CID from the publisher, never guess one.
4. Open the published URL, follow a detail fragment, reload it, check both themes and confirm `data/snapshot.json` and all relative assets load. Record the actual repository URL and public website URL in this README.

Repository URL: **not yet assigned**. Public website URL / CID: **not yet published**. Publication tracking record: [IdentityMD job](https://explorer.imd.fun/jobs/bac7bb5a-574e-48c5-aafe-d339d0c02cee); this is a job record, not the delivered website.

Design guidance attribution and licenses are retained in `artifacts/design-guidance-LICENSE.txt`; the Comic Neue license is in `public/fonts/OFL.txt`. Authentic project/NFT assets are accompanied by their source records in the featured evidence file.
