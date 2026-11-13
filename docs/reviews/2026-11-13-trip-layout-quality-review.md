# Trip layout quality review — November 13, 2026

## Scope

The baseline is commit `6dbd7c2`.
This review covers sticky trip chapters, single-photo widths, and the code that supports those changes.
It includes heading links, navigation, image selection, MDX compilation, test fixtures, and browser CI.

The initial working tree was clean.
The review found reproducible reading defects and gaps in the original tests.
Passing component tests did not prove that subsection links remained visible or that production fixtures exercised the feature.

## Findings and fixes

### P2 — Subsection links landed behind the chapter title

Every heading used a fixed 96px scroll margin.
An upward jump revealed the site navigation above the sticky chapter title.
At 390px, those elements covered approximately 26px of the target subsection heading.
At 1280px, they covered approximately 29px.
Almost the complete subsection title was hidden.

[`useTripChapterHeadings.ts`](../../src/features/trips/useTripChapterHeadings.ts) now measures chapter titles through the existing heading provider.
Each post shares one resize observer and one queued measurement frame.
The observer reads all dimensions before it writes styles.
It does not add a scroll listener or update React state during measurement.

[`index.css`](../../src/index.css) reserves the full navigation height, chapter title height, and a small gap for subsection links.
Using the full navigation height keeps upward jumps clear when navigation appears after scrolling starts.
Direct chapter links retain their own margin.
Tests cover h1 and h2 chapters, wrapped titles, upward jumps, and reloads.

### P2 — The navigation offset missed padding and border changes

The header observer used its default content-box measurement.
Adding 20px of vertical padding increased the header from 61px to 101px.
The stored offset remained 61px.
The navigation could cover the sticky title.

[`Layout.tsx`](../../src/components/Layout/Layout.tsx) now observes the border box.
Browsers without `ResizeObserver` update the measurement on viewport resize.
Unit tests verify cleanup and this fallback.
Browser tests change navigation content, header padding, and the header border separately.

### P2 — Large text caused overflow and left too little reading space

At 200% text size, navigation extended a 390px phone page to 496px.
Links at the right edge required horizontal scrolling.
Navigation can now wrap its rows and links.
Browser checks verify that all four navigation links remain within the phone width.

A long chapter title could also occupy most of a short screen.
The new layout rule returns a title to normal flow when navigation and the title exceed half the visible height.
This is a reading-space policy, not a standards threshold.
The title becomes sticky again when enough space returns.
The calculation uses the visual viewport when available.
Tests cover short screens, rotation, 200% text, and restoration of sticky behavior.

### P2 — Fixed image hints selected sources that were too small

Single photos advertised a maximum width of 720px.
Gallery hints also converted relative CSS widths into fixed pixel limits.
With larger text, a landscape image rendered at 1078px but selected a 960px source.

[`TripPhoto.tsx`](../../src/features/trips/components/TripPhoto.tsx) now enables native automatic sizes for lazy photos.
Eager photos retain explicit size hints.
The [HTML image standard](https://html.spec.whatwg.org/multipage/images.html#sizes-attributes) defines automatic sizes for lazy images.

[`tripPhotoSizes.ts`](../../src/features/trips/tripPhotoSizes.ts) supplies the shared text and media limits.
Fallbacks now use relative font units.
Gallery calculations preserve the fixed 12px gutters while scaling their relative widths.
This removes the duplicated text-column formula.

Browser checks verify actual source selection, not only attribute strings.
Both engines cover larger page text with automatic sizing.
A separate Chromium check uses a 24px browser font preference with automatic sizing disabled.
It covers eager photos and galleries at 900px, 1600px, and 2000px.
That preference check requires a Chromium launch flag and is skipped in WebKit.

The Chromium experiment evaluated source-size rem units from the browser default.
Automatic sizes also handle later page-level root-font overrides.
Explicit fallbacks cannot infer those page overrides in browsers without automatic sizing.
The application does not offer a root-font override control.

### P2 — The CI paths did not provide the claimed feature coverage

The default fixture suite ran in Chromium.
The WebKit fixture step selected only Pins.
The separate production trip suite did not include the new heading fixture.

The WebKit step now includes heading, gallery, and post-link fixtures.
A workflow regression verifies those selections.
Workflow permissions remain read-only.

The production trip MDX fixtures also lacked `format: trip` frontmatter.
Their heading transform therefore returned without creating chapter sections.
Those fixtures now match the imported story format.
A production-route test requires chapter sections and checks sticky placement and subsection clearance.

One production test still required the previous 1152px single-photo layout.
It now measures the photo against the text column.
Panorama checks retain their geometry and source-resolution assertions and accept the new automatic size hint.

### P3 — Heading tests left modified browser prototypes behind

Several tests replaced `scrollIntoView` without restoring its descriptor.
Later cases could inherit those mocks.
The tests now share a helper and restore the original descriptor after each case.

New checks cover disclosure state, the active subsection, replaced hash targets, and cancelled scroll frames.
Chapter checks also cover Strict Mode, removed chapters, missing browser APIs, and callbacks received after unmount.

## Coverage

The comparison below uses the same seven source files before and after the fixes.
It is not a whole-repository coverage result.

| Metric | Before | After |
| --- | --- | --- |
| Lines | 249 / 260 — 95.76% | 264 / 269 — 98.14% |
| Branches | 232 / 255 — 90.98% | 250 / 264 — 94.69% |
| Statements | 298 / 321 — 92.83% | 322 / 331 — 97.28% |
| Functions | 76 / 85 — 89.41% | 86 / 89 — 96.62% |

The new chapter measurement hook has 100% line, branch, statement, and function coverage.
Including both new source files gives 98.41% line coverage and 95.12% branch coverage.
The [measurement record](../performance/2026-11-13-trip-layout-quality-review.json) lists the source scope and test counts.

## Performance and security

Scrolling and chapter handoffs remain native CSS operations.
One observer serves all chapter titles in a post.
Resize events share a single animation frame.
Writing headings allocate no chapter observer.
Unmounting the final chapter removes listeners, disconnects the observer, and cancels its queued frame.

Production reading tests retain their JavaScript budgets and exclude visualization modules during initial reading.
They now save compressed-byte measurements as test attachments.
The review did not change those budgets.

| Initial route | JavaScript gzip bytes | Budget |
| --- | --- | --- |
| `/` | 109,247 | 125,000 |
| `/posts` | 114,421 | 125,000 |
| `/blog/reading-test` | 162,368 | 185,000 |
| `/trips/coastal-test` | 165,125 | 190,000 |

All three production browser projects returned these byte counts.
These measurements cover initial JavaScript requests. They do not measure total page transfer, input delay, or physical-phone performance.

The npm audit reported zero known vulnerabilities in the installed dependency tree.
The review did not identify a new input or authorization defect in the changed code.
These checks are limited to the reviewed change and known dependency advisories.

## Validation

| Check | Result |
| --- | --- |
| JavaScript tests | 3,198 passed across 222 files |
| Temperature Python tests | 18 passed |
| Focused coverage tests | 114 passed across seven test files |
| Chromium fixture tests | 32 passed |
| WebKit fixture tests | 31 passed; one Chromium-specific preference check skipped |
| Production reading tests | 87 passed across desktop Chromium, phone Chromium, and phone WebKit |
| Typecheck and lint | Passed |
| Production fixture build | Passed |
| npm advisory audit | Zero known vulnerabilities |

The browser total is 150 passed and one engine-specific skip.
The production build uses tracked content fixtures and a test browser key.
The tests require no Google access or live trip assets.
WebKit used the existing Linux WPE launcher and cached host libraries.
No hosted deployment ran during this review.

## Documentation and open work

The authoring guide now explains subsection clearance, tall headings, and image sizing.
The testing guide describes the browser matrix, resource cleanup, and source-size limits.
The review index links this report.
The physical-device TODO now separates trip reading from map performance checks.
Completed fixes remain in Git history.

## Remaining checks

Test a physical phone with large system text and browser zoom.
Check subsection links, chapter changes, rotation, and assistive navigation.
Record the device, browser, and result in the existing [physical-device task](../../TODO.md#physical-devices).
Linux browser emulation does not replace that check.
