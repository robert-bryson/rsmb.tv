# Pending changes review — 2026-10-01

The pending changes contained reader regressions despite 1,050 passing unit tests.
Two production browser tests failed before correction.
The main defects involved CSS scope, map state, content references, and navigation contracts.

This review covers the initial working changes and their direct dependencies.
It includes the trip build plugin, registries, article navigation, map controls, facts, and site header.
It does not certify every application feature or external service.
The review retains the intended layout and navigation changes.

## Findings and corrections

### P1: publication references lacked complete checks

The plugin checked post slugs, but it did not check trip IDs before every file access.
A trip ID could contain path separators in the HTML generation step.
A published trip could omit its manifest ID. Duplicate post slugs could create ambiguous routes and output files.

The plugin now checks visible post references before registry creation and HTML generation.
It rejects unsafe IDs and duplicate slugs. Production also rejects trip posts without a manifest ID.
Development still permits an incomplete trip. Production excludes unpublished drafts before these checks.

This is a build boundary defect. The review did not demonstrate remote access to private files.
Tests cover path separators, absolute paths, empty IDs, incorrect types, duplicates, missing references, and excluded drafts.
See [the plugin](../../scripts/trip-content-plugin.ts) and [contract tests](../../scripts/__tests__/tripContent.test.ts).

### P2: registry lookups accepted inherited properties

The registries used ordinary objects and direct property lookup.
The valid slug `constructor` could resolve to an inherited function when no matching manifest existed.
The loader could then call that function and fail before it returned a promise.
The build could also mistake an inherited property for an available summary.

Registry readers and the build now require own properties through `Object.hasOwn`.
Tests cover `constructor`, `toString`, `__proto__`, missing IDs, and valid entries.
See [registry tests](../../src/test/tripRegistries.test.ts).

### P2: map reloads reused readiness and errors

A numeric readiness counter remained positive after the map was replaced.
Hover updates could then set paint properties before the replacement map loaded.
A map error also remained visible after a different route loaded.

Readiness now identifies the loaded map instance. Paint updates require that instance to match the current map.
Map errors now include the route URL. An error from another route does not cover the new map.
The regression test delays the replacement map's load event and checks that paint updates wait.
See [map tests](../../src/test/tripRouteMap.test.tsx).

### P2: map controls removed recovery actions

The download link moved into a control that exists only after map creation.
A failed route request therefore removed the download action.
An error overlay could also leave obscured controls available to keyboard users.

The error caption now contains a download link. The map controls become inert while the error appears.
The stop list and story remain available.
Unit and production browser tests check the failed-request case.

The full-route action also started hidden on maps focused on a stop or track.
Readers had to move the map before they could request the full route.
Focused maps now show that action immediately. Overview maps still reveal it after movement.
The fixed-tile browser test checks reset, zoom, and attribution controls.

### P2: fact links did not match the registry

The facts created lowercase region links, but the registry added only the motorcycle model tag.
The general `motorcycle` link also depended on an explicit Sheet tag.
A valid link could therefore return an empty list that excluded the current trip.

The summary now includes regions. The registry derives region, motorcycle model, and general motorcycle tags.
A shared function creates the same tag value for both the facts and the registry.
Explicit Sheet tags keep their original text. Duplicate derived tags are removed.
Tests check filters, whitespace, duplicates, missing facts, and ordinary posts.
See [post tests](../../src/test/posts.test.ts) and [facts](../../src/features/trips/components/TripFacts.tsx).

### P2: CSS and header state broke reader feedback

The new hover rule applied to every article link with `!important`.
It forced MDX links to use their normal color during hover.
The production browser test detected this regression.

The rule now applies only to links without a class attribute.
Imported HTML retains its hover treatment. MDX components retain their own styles and inherited child colors.
Both browser suites check these cases.

The header also remained above the phone viewport after a navigation link received focus.
The CSS focus rule alone did not keep header state visible in that test.
The header now becomes visible on focus. Downward scrolling cannot hide it while it contains the active element.
Desktop and phone browser tests pass. A unit test checks the state change.
See [the layout](../../src/components/Layout/Layout.tsx).

### P2: canonical redirects discarded reader context

Collection redirects retained only the article slug.
A link to the other collection lost its heading fragment, query parameters, and original list filter.

Redirects now retain the search string, fragment, and navigation state.
Tests check the redirected location and the return link.
Adjacent article links remain within the current collection.
Previous selects an older article. Next selects a newer article.
The navigation has explicit accessible names and tests for thumbnail selection and scroll restoration state.
See [navigation tests](../../src/test/postNavigation.test.tsx) and [article tests](../../src/test/blogPages.test.tsx).

### P2: the Boise manifest claimed an unavailable track

The pending manifest added `2024-05-19-panther-creek-to-seattle`.
That ID does not occur in the available local route GeoJSON.
The changes also removed the reconstructed labels from two track names.

The unsupported reference is removed. The latest route names remain unchanged, as requested by the owner.
The publication tasks require identification of reconstructed tracks in public content.
The manifest retains the revised campsite names and six riding days.
Those authored facts still require verification before publication.
No source route, Google document, Sheet row, or CDN object was changed.
See [Boise publication tasks](../../TODO.md#boise-trip).

## Documentation and maintenance

The documentation now has an [index](../README.md) and a separate [blog publication guide](../blog-publishing.md).
The README links to detailed procedures instead of repeating the complete publication instructions.
The trip guide now describes fact filters, map controls, failure behavior, and adjacent article navigation.
Obsolete claims about displayed track distances are removed.
The revised text uses short instructions and consistent technical terms under the documented ASD-STE100 rules.
Historical reports retain their dated results and link to this review.

The TODO file contains incomplete work only.
The missing Boise route is an explicit source-data task.
The fixed-tile test now covers map controls. Route pixel checks and all map styles remain separate tasks.
Generated flight changes contained only new timestamps. Those changes are excluded from the commit.

## Validation

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript | Passed |
| Vitest | 1,077 tests passed in 81 files |
| Python temperature tests | 17 passed |
| Chromium smoke tests | 9 passed |
| Production trip browser tests | 22 passed across desktop and phone Chromium |
| Production Vite build | Passed with existing generated content |
| Dependency audit | Zero reported vulnerabilities |
| Documentation links and local heading links | Passed |
| Whitespace check | Passed |
| WebKit | Could not start because required host libraries are absent |

The same `npm run test:coverage` command produced both measurements.
The V8 report measures files loaded by the test suite. It does not cover every file in the repository.

| Metric | Before | After |
| --- | --- | --- |
| Statements | 73.03% | 73.74% |
| Branches | 65.21% | 66.04% |
| Functions | 70.19% | 71.05% |
| Lines | 75.92% | 76.49% |

The baseline had 1,050 passing unit tests. This review adds 27 tests.
The baseline trip browser suite had 20 passes and two failures.
The final suite has 22 passes.

The production build used the existing registry with 11 posts and one published post.
The separate fixture build checked published trip behavior without Google access.
This review did not run a new Google import or deploy infrastructure or assets.
The build still warns about large visualization chunks and Tailwind source maps.
CI includes WebKit and installs its system libraries. Local Chromium results do not substitute for that check.

## Remaining limits

Boise is not ready for publication. Its route sources, dates, distance, and story facts require review.
Historical temperature publication also remains blocked by the tasks in `TODO.md`.
Map tests still need route pixel checks, all basemap styles, and broader WebKit coverage.
The large importer remains a maintenance risk. Separate parsing and validation changes from future presentation work.
Do not interpret passing component mocks as proof of correct browser behavior.
