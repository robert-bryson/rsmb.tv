# Trip assets and galleries review - 2026-10-01

## Scope

This review covers the pending trip asset, document conversion, gallery, and Boise manifest changes.
It also checks generated flight data and the related tests.
It does not certify the entire repository, external services, or unpublished story facts.
No Google document, Sheet row, CDN asset, or infrastructure configuration was changed.

## Findings

### P1: failed preview copies could erase working assets

The preview command removed its destination directories before it copied replacement files.
A failed copy could leave photos or routes incomplete. Concurrent copies could continue after the command reported failure.

The command now stages photos and routes before replacement.
It waits for each photo copy to settle before it removes failed staging files.
It restores the previous preview if installation fails. A failed restoration retains the backup for manual recovery.
Tests check failed copies, failed installation, successful replacement, and existing preview symlinks.
Another test confirms that failed restoration retains the backup and reports both errors.
See [preview preparation](../../scripts/prepare-trip-assets-dev.js) and [its tests](../../scripts/__tests__/prepareTripAssetsDev.test.ts).

### P1: the copy fallback could truncate existing files

The fallback opened the destination directly while it read the source.
A failed source read could destroy an existing destination. A same-file copy could truncate its own source.

The fallback now writes a temporary file before it replaces the destination.
Tests check binary data, all five fallback error codes, missing sources, failed writes, failed replacement, and same-file copies.
Other native copy errors still propagate without fallback.
See [the copy helper](../../scripts/copy-trip-asset.js) and [its tests](../../scripts/__tests__/copyTripAsset.test.ts).

### P2: preview IDs lacked boundary checks

The exported preview functions accepted IDs before checking their path syntax.
The mirror function used those IDs in destination paths.

Both entry points now reject path separators, absolute paths, and invalid ID characters before filesystem changes.
The tests verify that rejected IDs never reach asset preparation.
This is a local filesystem boundary defect. The review did not demonstrate a remote attack.

### P2: malformed fences skipped shortcode validation

The prose scanner accepted backticks in a backtick fence's info string.
CommonMark does not accept that opening marker. The scanner could therefore skip shortcode validation outside a valid code block.

The scanner now rejects that marker. Tests also check escaping, longer fences, and mismatched closing markers.
The tested malformed input did not execute a module statement. This review does not claim an execution vulnerability.
See [document conversion](../../scripts/sync-blogs.js) and [MDX tests](../../scripts/__tests__/googleDocsMdx.test.tsx).

### P2: viewer captions changed after gallery expansion

Hidden gallery entries omitted photo locations. Visible entries included those locations.
Blank captions also produced different fallback text in the hero viewer.

A shared formatter now supplies viewer captions for visible, hidden, and hero entries.
Tests check expansion, collapse, locations, blank captions, and alt-only caption semantics.
Alt-only captions remain visible without repeating the image description to assistive technology.
See [the formatter](../../src/features/trips/components/tripPhotoSwipe.ts) and [component tests](../../src/test/tripStory.test.tsx).

### P2: reduced-motion captions still animated

The reduced-motion selector had lower specificity than the hover selector.
The browser therefore retained caption transitions when reduced motion was enabled.

The reduced-motion selectors now override hover and dismissal transitions.
The browser test checks desktop hover, keyboard focus, Escape, phone captions, reduced motion, and horizontal overflow.
See [site styles](../../src/index.css) and [browser tests](../../tests/trips/reading.spec.ts).

## Content checks

The Boise manifest passes the shared schema.
All 46 existing photo entries remain unchanged. The manifest adds 30 photos.
The highlights gallery contains all 76 photos in chronological order.
These checks do not verify captions, recorded dates, route reconstruction, public asset availability, or story totals.
The [Boise publication tasks](../../TODO.md#boise-trip) remain open.

The flight data changes contain generated timestamp updates.
They are retained with the supplied changes. Stable generation remains an explicit maintenance task.

## Validation

The review adds 22 unit test cases and one browser test in two Chromium projects.

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript | Passed |
| Vitest with V8 coverage | 1,113 tests passed in 82 files |
| Python temperature tests | 17 passed |
| Production trip browser tests | 24 passed across desktop and phone Chromium |
| Synthetic production build | Passed |
| Dependency audit | No reported vulnerabilities |
| Boise schema and existing photo preservation | Passed |

| Coverage metric | Result |
| --- | --- |
| Statements | 74.03% |
| Branches | 66.57% |
| Functions | 71.38% |
| Lines | 76.73% |

The preceding review recorded 73.74% statement coverage and 66.04% branch coverage.
The current results are higher, but the loaded files and code changed between reviews.
This comparison is not a controlled baseline measurement.
The V8 report covers loaded files. It does not measure every repository file.

The synthetic build does not import Google content or confirm real public asset URLs.
WebKit was not run in this review. CI must provide that browser check.
Existing large-chunk and Tailwind source-map warnings remain open in the TODO file.

## Follow-up review

This review checks the two local commits and the supplied working-tree changes.
It concentrates on trip state, navigation, asset handling, publication checks, and generated flight output.
The preceding sections retain their original results. The results below apply after the follow-up fixes.
This review does not certify the entire repository or compliance with the complete ASD-STE100 dictionary.
The updated documentation uses short sentences, active voice, and consistent technical terms.

### P2: gallery expansion survived a gallery change

The component stored expansion without a gallery identity.
After expansion, a different gallery could start with every photo visible.
The component now keys its state by gallery ID.
Its lightbox also refreshes when the manifest photo list changes.
A regression test changes the gallery after expansion and checks the nine-photo limit.
See [the gallery](../../src/features/trips/components/TripGallery.tsx) and [its tests](../../src/test/tripStory.test.tsx).

### P2: map selection did not follow the requested stop

The camera effect followed a new stop ID. The selected stop state retained the old ID.
The initial stop reference also retained its first value when a track change created another map.
The camera, marker paint, and accessible button state could therefore disagree.

Selection now belongs to the requested stop and route URL.
A prop change resets selection before React commits the update.
Map creation reads the current stop through an Effect Event.
The existing map remains active when only the requested stop changes.
Tests cover stop changes, cleared requests, route replacement, track replacement, and marker selection.
The marker test also rejects a non-string feature ID.
See [the map](../../src/features/trips/components/TripRouteMap.tsx) and [its tests](../../src/test/tripRouteMap.test.tsx).

### P2: unchanged flight data produced new timestamps

Three generators inserted the current time on every run.
Identical source data therefore produced changed tracked output.
This made reviews noisy and suggested a data change that had not occurred.

A shared writer compares the complete JSON payload with the existing output.
It ignores only the candidate generation timestamp during that comparison.
Equal payloads retain their existing bytes and timestamp.
Changed geometry or metadata receives the new timestamp.
Invalid existing JSON is replaced. Other filesystem read failures propagate.
The writer does not change its input object.

Tests run each generator twice with identical inputs.
The state boundary test uses a fixed remote response and requires no network access.
Other tests check changed payloads, invalid JSON, invalid timestamps, and read failures.
See [the writer](../../projects/flights/scripts/writeFlightGeoJson.js) and [generator tests](../../scripts/__tests__/flightBuildScripts.test.ts).

### P3: the open photo review count was stale

The supplied Boise manifest contains 81 photos. The current TODO still specified 76.
The TODO now specifies 81. The earlier report retains its historical count.
All 81 highlights entries are unique. Each photo occurs in that gallery.
The supplied changes add five photos without changing the 76 existing photo entries.
The manifest passes the shared schema and declares five route tracks.
These checks do not verify captions, dates, distances, reconstruction, or public asset availability.
Keep the [publication blockers](../../TODO.md#boise-trip) open until those checks pass.

### Follow-up validation

The follow-up adds nine unit test cases and extends two existing generator cases.

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript | Passed |
| Vitest with V8 coverage | 1,122 tests passed in 82 files |
| Python temperature tests | 17 passed |
| Production trip browser tests | 24 passed across desktop and phone Chromium |
| Browser smoke tests | 9 passed |
| Synthetic production build | Passed |
| Dependency audit | No reported vulnerabilities |
| Boise schema and gallery completeness | Passed |

| Coverage metric | Earlier report | Follow-up |
| --- | --- | --- |
| Statements | 74.03% | 74.14% |
| Branches | 66.57% | 66.83% |
| Functions | 71.38% | 71.47% |
| Lines | 76.73% | 76.83% |

The shared writer has 100% statement, branch, and function coverage.
The map has 190 of 206 statements and 106 of 120 branches covered.
The gallery has 24 of 27 statements and 23 of 26 branches covered.
The aggregate comparison uses the earlier recorded report, not a separate baseline run with identical loaded files.
Subprocess tests check generator behavior, but their execution does not contribute to V8 coverage.

WebKit remains unverified in this review. CI enables WebKit on a host with its required system libraries.
The large visualization chunk and Tailwind source-map warnings remain open.
No Google source content, cloud assets, or infrastructure was changed.
