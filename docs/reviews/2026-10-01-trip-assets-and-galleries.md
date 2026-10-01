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
