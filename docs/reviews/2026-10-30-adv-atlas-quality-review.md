# ADV Atlas quality review: 2026-10-30

## Scope

The review compares commit `2c3f2c9` with `f1f0d76` and includes the pending trip content.
It covers atlas rendering, navigation, publication filtering, build configuration, tests, and current documentation.
Independent standards and specification reviews checked the recent changes.

The initial full suite had one failure among 1,700 tests.
The initial atlas browser checks passed 61 cases and skipped two desktop-only interactions on phones.
Those checks missed the camera races and fullscreen control loss described below.

## Standards

### P2: Development builds advertised unpublished production URLs

`build:dev` imports drafts, then runs the same artifact generators as production.
The RSS and sitemap generators accepted every registry entry.
They wrote unpublished titles, descriptions, and URLs with the production hostname.
The corresponding production articles did not exist.
HTML `noindex` metadata does not remove entries from these XML files.

Both generators now use `filterPublishedPosts` from `scripts/siteMetadata.js`.
The predicate matches the application's publication rule: only an explicit `development.published: false` excludes a record.
This retains older published records without development metadata.
The loaders and public XML builders both enforce the rule.
Generation counts include published records only.

New tests use published, unpublished, and legacy records together.
They check file output, direct builder calls, counts, and registry preservation.
The draft exclusion tests failed before the fix.

### P2: Fullscreen removed essential controls

MapLibre's default fullscreen target is its map container.
The atlas report panel, overview control, route choices, and retry message were outside that element.
Entering fullscreen therefore removed the controls needed to select shared roads or recover the renderer.
A Chromium inspection confirmed that fullscreen excluded both the report panel and header.

The page now supplies its main element through a React ref.
The map uses that element as the fullscreen target.
The fullscreen control instance survives renderer retries because its target remains mounted.
This also retains the control's current fullscreen state after retry.

Browser tests enter fullscreen, select an overlapping route, lose the WebGL context, retry, and exit fullscreen.
The sequence passes in desktop Chromium, phone Chromium, and phone WebKit.

### P2: The Amplify test no longer matched the build configuration

The test required the literal command `- npm run build`.
The configuration now selects a build command by branch.
That stale assertion failed the full suite despite passing atlas checks.

The replacement test executes the real shell condition with a substitute `npm` function.
It checks `dev`, `main`, `feature/dev`, and an empty branch name.
Only `dev` selects `build:dev`.
The test also parses and checks the artifact and cache configuration.
It does not import Google content or start a deployment.

### P3: Current content instructions disagreed with the manifest

The Route 66ish guide named an older hero and claimed that distance and riding days were unset.
The manifest contained a different hero, 2,619 recorded miles, and two riding days.
The author confirmed eight riding days during this review.

The manifest now uses eight riding days.
The guide and outline identify hero `r004114` and distinguish recorded distance from an odometer total.
The provisional trip end remains an open publication check.
The pending PCH distance and motorcycle fields are retained.

The testing guide now uses shorter sentences and grouped behavior checks.
The documentation index links the Route 66ish guide and outline.
Historical reviews retain their original findings.

Standards result: four findings corrected. The publication leak had the greatest exposure risk.

## Specification

### P2: A delayed selected route could override manual movement

The atlas plan requires delayed responses to preserve newer selections and manual camera movement.
The implementation suppressed a delayed fit only while `fitVersion` was zero.
Selecting an unloaded route increments that value.
A later route response could therefore pan and zoom after the reader had already moved the map.

Manual `movestart` events now mark the current selection and fit version as handled.
The delayed response cannot fit that same request.
A new explicit selection or overview request receives a different key and can fit normally.
Programmatic movement does not cancel pending fits.

Unit tests reproduce the selected-route race and check the later explicit fit.
The browser test holds a route response, selects that route, pans, and releases the response.
It compares painted route bounds before and after release.
It then verifies that an explicit overview reset still works.

### P2: Moving before initial loading could hide the overview control permanently

The plan requires an overview control whenever the camera differs from the overview.
Early manual movement suppressed the initial fit but left `lastFit` unset.
The camera comparison then returned before reporting the changed view.
The reader could move the map without receiving an overview reset control.

Recording the handled fit request also permits the camera comparison after loading settles.
The new unit and browser cases verify cancellation, overview availability, and an explicit reset.
Both camera unit regressions failed before the fix.

Specification result: two camera defects corrected. The delayed selected-route fit could overwrite the reader's newer action.

## Test improvements

The changes add 16 unit cases across publication, configuration, rendering, and content validation.
Real Vite fixture builds check production and development article HTML.
They verify canonical URLs, escaped titles, hero metadata, incomplete preview shells, and crawler instructions.

PCH and Route 66ish share responsive-photo and gallery-reference checks.
The Route 66ish checks validate all 57 photos, dated assignments, route references, and outline shortcodes.
They also verify that the outline places each selected photo exactly once.

Browser coverage adds two desktop camera cases and a fullscreen sequence on all three configured browsers.
The camera measurements include faded context routes while excluding the gray basemap.
Fixture tests retain the existing article JavaScript budgets.

## Coverage

Both measurements use the final source, compiler, and V8 coverage provider.
The control excludes the 12 new cases in the eight measured test files.
The complete measurement includes those cases.
The four additional authoring cases are outside this comparison.

Measured source files:

- `scripts/trip-content-plugin.ts`
- `scripts/generate-rss.js`
- `scripts/generate-sitemap.js`
- `scripts/siteMetadata.js`
- `src/features/trips/atlas/TripAtlasMap.tsx`
- `src/pages/AdvAtlas.tsx`

| Measure | Control: 121 tests | Complete: 133 tests |
| --- | ---: | ---: |
| Statements | 74.76% | 78.97% |
| Branches | 68.95% | 73.52% |
| Functions | 71.87% | 76.25% |
| Lines | 81.07% | 83.46% |

The content plugin's statement coverage increased from 77.94% to 87.50%.
Its line coverage increased from 83.33% to 91.17%.
The atlas renderer's branch coverage increased from 56.15% to 63.54%.
These percentages describe the listed files, not the entire repository.
The browser checks provide additional renderer coverage outside the unit coverage report.

## Final validation

| Check | Result |
| --- | --- |
| ESLint | Passed with no warnings |
| TypeScript project checks | Passed |
| Full Vitest suite | 1,716 tests passed in 116 files |
| Temperature pipeline | 17 Python tests passed |
| Atlas and article-budget browsers | 66 passed; six expected phone skips |
| Production Vite build with existing local content | Passed |
| Development Vite build with existing local content | Passed |
| npm vulnerability audit | Zero reported vulnerabilities |
| Patch whitespace check | Passed |
| Local documentation links | No broken file links in 49 Markdown files |

The browser run used desktop Chromium, phone Chromium, and phone WebKit with fixed content and tiles.
Four phone skips exclude desktop keyboard-panning cases.
The other two exclude a desktop hover case.
The builds used existing generated content. They did not import Google documents or publish assets.
Vite reported plugin timing advisories during the local builds.
The production build regression rejects source-map and other unexpected build warnings.

Remaining source confirmation, endpoint privacy review, and real-phone measurements remain in [TODO.md](../../TODO.md).
