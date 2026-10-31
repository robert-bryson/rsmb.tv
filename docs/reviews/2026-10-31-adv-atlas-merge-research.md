# ADV Atlas pre-merge review and research

Review date: October 31, 2026.

Follow-up: the [merge fixes and dependency update](2026-10-31-adv-atlas-merge-fixes.md) correct both interaction defects and reconcile the stale instructions below.
The full dependency audit remains unresolved. This report preserves the findings at its original reviewed head.

The branch has two confirmed interaction defects and a failing dependency audit.
Production filtering and published trip assets pass the checks described below.
The remaining draft content needs publication work, but it does not enter the production registry.

## Scope and decision

The diff command is `git diff f27cb017633c13aec8980ba07b3edc98831adc4f...003ee94d943f50aed997cedf61ae17bed22810f1`.
The baseline is `main`; the head is `feature/motorcycle-trip-atlas`.
The branch contains 23 commits and changes 82 files against that baseline.
GitHub's current `main` matches the baseline. No pull request for this branch or CI results for this head were found through the connected GitHub tools.
Research covers deployment, publication boundaries, live media, dependency security, and existing open work.
Independent standards and specification reviews supplied the two browser reproductions below.

| Item | Classification | Before merge |
| --- | --- | --- |
| An explicit report return can restore another visit's atlas state | Introduced P2 specification defect | Correct the return identity and add a regression |
| Escape leaves shared-road choices open after focus leaves the map wrapper | Introduced P3 interaction defect | Correct dismissal and add a regression |
| Full dependency audit exits with 12 moderate findings | Preexisting CI failure | Resolve the dependency problem or explicitly decide the CI policy |
| Four unpublished trips have unavailable CDN media | Publication prerequisite; also limits hosted development previews | Keep these trips unpublished until their release checks pass |
| Kalaloch and two source-document instructions are stale | Documentation cleanup | Reconcile the instructions with current source evidence |
| Real-phone cold-cache performance remains unmeasured | Existing release check | Complete the check before broad release |

The audit failure means this branch cannot currently satisfy the checked-in CI workflow unchanged.
The workflow runs audit before unit and browser tests.
Later steps normally stop when that command fails.
See [CI:56](../../.github/workflows/ci.yml#L56) and [the audit script:43](../../package.json#L43).
The existing dependency task records the advisory; it does not exempt that check.

## Standards: shared-road choices do not always dismiss with Escape

Severity: P3. Status: reproduced at the reviewed head.

1. Open the shared-road choice panel.
2. Move focus to the atlas **Projects** link.
3. Press Escape.

The panel remains open.
Its Escape listener belongs to the map wrapper, which does not contain the focused link.
The page's document listener clears hover state but does not close the choices.
See [TripAtlasMap.tsx:320](../../src/features/trips/atlas/TripAtlasMap.tsx#L320) and [AdvAtlas.tsx:130](../../src/pages/AdvAtlas.tsx#L130).

The [testing contract:264](../trips/TESTING.md#L264) states: "Escape dismisses previews and choices."
Register dismissal at page or document scope, and add a regression that moves focus outside the map before pressing Escape.
The visible close button remains usable, limiting the impact.
No other concrete documented-standard breach or material baseline code smell was confirmed.

The reproduction records one remaining choice panel after Escape, with **Projects** focused.
Evidence: `/private/tmp/rsmb-atlas-merge-escape-repro.mjs` and `/private/tmp/rsmb-atlas-merge-escape-repro.json`.
These temporary files are local verification artifacts, not repository sources.

## Specification: an explicit return can restore the wrong atlas visit

Severity: P2. Status: reproduced at the reviewed head.

The [atlas contract:26](../trips/ADV-ATLAS.md#L26) requires returns to restore the camera, panel state, and card position.
The following sequence violates that contract:

1. Open selected atlas visit A with its panel open.
2. Open its report.
3. Select **View this trip on the map**, creating visit B at the same atlas URL.
4. Collapse B's panel.
5. Use browser Back to return to the original report.
6. Select **Back to map**.

The returned panel is closed, although visit A had an open panel.
A's history-key snapshot still exists and contains the correct state.
Visit B overwrites the shared URL snapshot.
The report carries only that URL, so its explicit return cannot identify A's snapshot.

See [AdvAtlas.tsx:50](../../src/pages/AdvAtlas.tsx#L50), [the report link:226](../../src/pages/AdvAtlas.tsx#L226), and [tripAtlasSession.ts:68](../../src/features/trips/atlas/tripAtlasSession.ts#L68).
The return should retain the originating history identity through report navigation and reloads.
Preserve that identity through previous/next links, series links, and the header and footer return links.
A regression should cover repeated visits to the same URL with different saved states.
The panel mismatch is directly reproduced. Camera and card-scroll restoration use the same overwritten session, so they can be affected by the same identity loss.

Evidence: `/private/tmp/rsmb-atlas-merge-return-alias-repro.mjs` and `/private/tmp/rsmb-atlas-merge-return-alias-repro.json`.
The reproduction confirms the same original report history entry before the final return.
Its expected panel state is `true`; its actual panel state is `false`.

Standards: one P3 finding. Specification: one P2 finding. No significant scope expansion was confirmed.

## Deployment and publication boundaries

### Amplify preserves the production command on main

Only `AWS_BRANCH=dev` selects `npm run build:dev`.
`main`, feature branches, and an empty branch variable select `npm run build`.
The artifacts remain `dist/**/*`; caching remains npm-only.
See [amplify.yml:10](../../amplify.yml#L10).

AWS defines `AWS_BRANCH` as the current build's branch name.
Its [environment variable reference](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html) supports the branch condition.
The repository also [executes the actual condition with substitute npm commands](../../scripts/__tests__/amplifyConfig.test.ts#L44).

The production script still imports published Google content, generates artifacts, checks types, and runs `vite build`.
The new development script imports drafts and runs `vite build --mode development`.
See [package.json:13](../../package.json#L13) and [sync-blogs-dev.js:24](../../scripts/sync-blogs-dev.js#L24).

### Vite mode and DEV have different purposes

With default environment settings, `vite build --mode development` retains `NODE_ENV=production` and `import.meta.env.DEV=false`.
Its `import.meta.env.MODE` is `development`.
This follows Vite's [official mode table](https://vite.dev/guide/env-and-mode#node-env-and-modes).
Installed Vite `8.3.5` derives `DEV` and `PROD` from `isProduction` in `node_modules/vite/dist/node/chunks/node.js:37798` and `:37914`.

The application checks both values in [isDevelopmentContent:2](../../src/utils/developmentContent.ts#L2).
Editorial previews therefore appear in hosted development builds.
The manifest parser uses `DEV` for local media rewriting, so hosted previews retain CDN URLs.
See [tripManifests.ts:8](../../src/features/trips/tripManifests.ts#L8).
Summary generation separately checks `config.command === 'serve'` before rewriting media paths.
See [trip-content-plugin.ts:57](../../scripts/trip-content-plugin.ts#L57).

An external `NODE_ENV=development` override would change those Vite flags.
This review did not inspect Amplify account settings.
The repository scripts do not set that override.

### Production excludes unpublished reports and their manifest chunks

The content plugin identifies production as a build whose mode is not `development`.
It filters unpublished metadata, strips development fields, and loads only referenced published manifests.
Missing published bodies or manifests stop production compilation.
See [trip-content-plugin.ts:19](../../scripts/trip-content-plugin.ts#L19), [:24](../../scripts/trip-content-plugin.ts#L24), and [:50](../../scripts/trip-content-plugin.ts#L50).

The atlas also excludes draft reports unless development content is enabled.
See [tripAtlasEntries.ts:40](../../src/features/trips/atlas/tripAtlasEntries.ts#L40).
Changing a manifest suffix from `.json.draft` to `.json` does not publish its reports.
The Sheet's publication value remains the publication boundary.

Development HTML receives `noindex, nofollow`, including emitted article pages.
RSS and sitemap generators filter unpublished records at both loading and XML construction.
See [trip-content-plugin.ts:75](../../scripts/trip-content-plugin.ts#L75), [:93](../../scripts/trip-content-plugin.ts#L93), [generate-rss.js:35](../../scripts/generate-rss.js#L35), and [generate-sitemap.js:77](../../scripts/generate-sitemap.js#L77).

The coordinator's direct Vite builds passed for both modes using existing local content.
Production emitted only the three published trip stories and excluded the four draft manifest chunks.
Development emitted the draft manifests and crawler metadata.
Those builds did not perform a fresh Google synchronization or deploy anything.

## Live publication and asset checks

The public [Blog Posts Sheet](https://docs.google.com/spreadsheets/d/1veNLJMfE21Px0JEVUoV9ClLJaDATy1DkpoWFruCPjMI/edit) was read without modification.
It marks Ocean Shores, Boise, and Kalaloch published.
The other six trip report rows remain unpublished.
Those six rows represent four trips because the three 2026 reports share one manifest.

All 910 distinct external URLs referenced by the seven manifests received HEAD requests.
The collection includes photo `src`, every `srcSet` candidate, combined routes, and external animation media.
The check completed at `2026-10-31T15:32:46.301Z`.

| Trip | Sheet publication | URLs checked | HTTP 200 | HTTP 403 |
| --- | --- | ---: | ---: | ---: |
| Boise 2024 | Yes | 238 | 238 | 0 |
| Kalaloch 2024 | Yes | 76 | 76 | 0 |
| Ocean Shores 2024 | Yes | 31 | 31 | 0 |
| ON–QC–New England 2026 | No, all three reports | 4 | 0 | 4 |
| PCH 2024 | No | 308 | 0 | 308 |
| Mississippi–Wisconsin 2025 | No | 79 | 0 | 79 |
| Route 66ish 2025 | No | 174 | 0 | 174 |
| Total | | 910 | 345 | 565 |

GET requests also checked every combined route.
The three published responses pass the repository's `isRouteGeoJson` validator.
They contain every track ID declared by their manifests.
Boise has six route features, Kalaloch three, and Ocean Shores two.
The four draft route responses return S3 `AccessDenied` XML.
HTTP 403 alone does not establish whether an object is missing or restricted.

Representative direct sources are the [Boise route](https://data.rsmb.tv/trips/boise-2024/geo/route.geojson), [Kalaloch route](https://data.rsmb.tv/trips/kalaloch-2024/geo/route.geojson), and [Ocean Shores route](https://data.rsmb.tv/trips/ocean-shores-2024/geo/route.geojson).
Origin-bearing requests confirm browser access for `https://www.rsmb.tv` and `https://dev.rsmb.tv`.
The apex site redirects to `https://www.rsmb.tv/` with HTTP 301.
The origin list matches [temperature-data.tf:69](../../infra/temperature-data.tf#L69).

These results clear media availability for the three current production trips at the checked time.
They do not establish photo correctness, caption correctness, or real-device performance.
HEAD checks establish availability, not successful decoding of every image.

### Hosted development has incomplete draft media

All four draft trips have local combined routes under `public/data/trips/` in this workspace.
Their CDN destinations remain unavailable.
Hosted development deliberately retains CDN URLs, so these cards show unavailable photos and route errors there.
Local previews use the prepared media instead.
The [atlas guide:44](../trips/ADV-ATLAS.md#L44) documents this distinction.

The production importer validates public media before it writes published content.
It also checks route geometry and declared track IDs.
Development import skips the network media gate.
See [sync-blogs.js:562](../../scripts/sync-blogs.js#L562) and [:1356](../../scripts/sync-blogs.js#L1356).
Uploading reviewed draft assets remains a publication prerequisite, not a production atlas dependency.

### Reproducible media validation

This command checks all external media for current published trips without writing generated content:

```bash
node --input-type=module <<'NODE'
import fs from 'node:fs';
import { validateTripAssetUrls } from './scripts/sync-blogs.js';
const posts = JSON.parse(fs.readFileSync('src/content/posts.json', 'utf8'))
    .filter(post => post.development?.published !== false);
const manifests = new Map();
for (const post of posts.filter(post => post.format === 'trip')) {
    const file = `src/content/trips/${post.tripId}.json`;
    manifests.set(post.tripId, JSON.parse(fs.readFileSync(file, 'utf8')));
}
await validateTripAssetUrls(posts, manifests);
console.log('Published external trip media and route validation passed.');
NODE
```

The full HEAD results and route summaries are saved locally in `/private/tmp/rsmb-atlas-merge-cdn-result.json`.
The collection and checker are `/private/tmp/rsmb-atlas-merge-cdn-input.json` and `/private/tmp/rsmb-atlas-merge-check-cdn.mjs`.
These temporary artifacts do not update the Sheet, Google Docs, S3, or CloudFront.

## Dependency audit and release constraints

Both audits used the configured npm `12.2.1`, installed only in a temporary cache.
The host Node.js version was `26.12.0`, within the declared engine range.
The deployment and CI Node version remains `.nvmrc`'s `24.22.1`.

| Audit | Exit status | Findings |
| --- | ---: | --- |
| Full tree, moderate threshold | 1 | 12 moderate; no high or critical |
| Production tree, `--omit=dev` | 0 | Zero |

The underlying advisory is [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
It concerns excessive resource consumption from attacker-controlled minimatch patterns at optimization level 2 or higher.
Versions below `11.0.1` are affected.
The installed minimatch version is `10.2.6`.
The 12 package findings reflect this advisory's propagation through the ESLint dependency tree.
They are not 12 independent advisory records.

Current official registry manifests still exclude the patched major:

| Package | Latest checked version | Declared minimatch requirement | Primary source |
| --- | --- | --- | --- |
| `eslint` | `10.14.0` | `^10.2.6` | [Registry manifest](https://registry.npmjs.org/eslint/latest) |
| `@eslint/config-array` | `0.23.5` | `^10.2.4` | [Registry manifest](https://registry.npmjs.org/@eslint%2fconfig-array/latest) |
| `@typescript-eslint/typescript-estree` | `8.72.1` | `^10.2.2` | [Registry manifest](https://registry.npmjs.org/@typescript-eslint%2ftypescript-estree/latest) |
| `minimatch` | `11.0.3` | Patched major available | [Registry manifest](https://registry.npmjs.org/minimatch/latest) |

The registry checks agree with the earlier reviews, but were repeated for this report.
A normal update to those latest toolchain releases does not permit minimatch 11 through these ranges.
The repository prohibits forced incompatible dependency majors in [README.md:143](../../README.md#L143).
No override, forced audit fix, dependency downgrade, or security-gate change was made.
The finding remains tracked in [TODO.md:62](../../TODO.md#L62).

The branch changes no dependency declarations or lockfile entries.
Baseline and head have the same `package-lock.json` SHA-256:
`035d460def604221888212d24bb1dbd85ac324ecd9e18f9c0b515de7aa76015c`.
The audit failure therefore predates the atlas change.
Its age does not make the current CI check pass.

Reproduce the configured audits after selecting npm `12.2.1`:

```bash
npm --version
npm audit --audit-level=moderate
npm audit --omit=dev --audit-level=moderate
git diff f27cb017633c13aec8980ba07b3edc98831adc4f..003ee94d943f50aed997cedf61ae17bed22810f1 -- package-lock.json
```

Saved local evidence: `/private/tmp/rsmb-atlas-merge-npm12-audit-full.json`, `/private/tmp/rsmb-atlas-merge-npm12-audit-production.json`, and `/private/tmp/rsmb-atlas-merge-registry-versions.json`.
The production-only result does not replace the full audit required by CI.

## Open work and stale instructions

The [open-work list](../../TODO.md) separates publication blockers, atlas checks, dependency work, and maintenance.
The following distinctions matter for the merge decision.

### Publication work remains for drafts

PCH and Route 66ish need finished prose, reviewed media, public uploads, and the checks linked from their TODO entries.
Mississippi–Wisconsin still lacks a source Doc ID and description in Sheet row 7.
The three 2026 reports retain partial descriptions and need series metadata and final report boundaries.
The 2026 manifest currently contains one temporary hero photograph.
Recovered mileage, riding days, dates, stops, and motorcycle details remain provisional.

The live Sheet confirms these publication gaps.
The [source inventory:69](../trips/TRIP-SOURCE-INVENTORY.md#L69) and [:93](../trips/TRIP-SOURCE-INVENTORY.md#L93) describe their current treatment.
These records remain unpublished, so their incomplete prose and provisional facts do not block the published-only atlas.
The preexisting [multipart-trip research](2026-10-31-adv-atlas-multipart-trips-research.md) covers future chapter-navigation design separately.
This report does not replace it.

### Some publication instructions no longer match the sources

The [Kalaloch TODO:27](../../TODO.md#L27) records an October 1 HTTP 403 result and still requires uploads and `published=false`.
Current evidence shows all 76 referenced URLs available and the Sheet value already `Yes`.
The historical observation can retain its date, but the active upload and publication instructions need reconciliation.
Remaining source, date, mileage, and caption checks still require their own evidence.
This review does not mark those editorial checks complete.

The [PCH checklist:104](../trips/pch-2024-galleries.md#L104) still instructs creation and linking of a source Doc.
The live Sheet already contains that link.
The [Route 66ish checklist:170](../trips/route-66ish-2025-galleries.md#L170) and [closing note:178](../trips/route-66ish-2025-galleries.md#L178) make the same stale claim.
Its source Doc is linked, while its missing description remains an actual task.
These are documentation cleanup items, not evidence of unavailable production content.

### Existing maintenance work remains separate

The real-phone cold-cache check remains open in [TODO.md:58](../../TODO.md#L58).
Emulated phone browsers do not establish physical-device transfer or initialization costs.
Linux CI also needs a successful run after the audit issue is addressed.
This research did not execute an Amplify deployment or certify production account configuration.

Existing maintenance tasks include MapLibre loading and worker costs, map-module extraction, and splitting the large Google importer.
See [TODO.md, build and maintenance](../../TODO.md#build-and-maintenance).
They remain follow-up work unless a measured regression changes their priority.
The reviewed runtime and importer files contain no additional `TODO`, `FIXME`, `HACK`, or `XXX` markers.
That search is not a proof that further defects do not exist.

## Application verification

The coordinator performed application checks separately from this read-only deployment and dependency research.
These checks used Node.js `26.12.0` and host npm `11.20.0`.
The dependency audits separately used the configured npm `12.2.1`.

| Check | Result |
| --- | --- |
| ESLint | Passed, no warnings |
| TypeScript project checks | Passed |
| Complete Vitest suite | 1,765 passed |
| Python temperature tests | 17 passed |
| Production trip browser suite | 188 passed; 10 expected skips |
| Fixed-data fixture browser suite | 79 passed; five expected skips |
| Production and development Vite builds | Both passed using existing generated content |
| Full dependency audit | Failed: 12 moderate development findings |
| Production dependency audit | Passed: zero findings |

The trip suite covers desktop Chromium, phone Chromium, and phone WebKit.
The fixture suite covers Chromium and desktop WebKit.
The combined browser result is 267 passes and 15 expected skips.
The skips cover existing browser or device exclusions; they do not clear the two additional reproductions above.

Build inspection confirmed published-only production stories and manifests, development previews, and development `noindex` metadata.
The build summary is `/private/tmp/rsmb-atlas-merge-build-summary.json`.
Temporary build directories were removed after inspection; logs and the summary remain local.

No clean dependency installation, live `npm run build` Google sync, physical-phone check, or actual Linux CI run was performed.
Direct Vite builds establish compilation with current generated content, not the complete external publication pipeline.

No application, dependency, Sheet, document, or publication state was modified by this research.
This review adds this report and its documentation index entry.
The uncommitted multipart-trip report and its existing index entry were present before this review and remain intact.
