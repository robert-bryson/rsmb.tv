# Trip tests

Use fixed content for automated checks. Do not require Google access or published trip assets.
The fixtures are in `tests/fixtures/trip-content/`.

## Browser setup

Install the browser files before the first run:

```bash
npx playwright install --with-deps chromium webkit
PLAYWRIGHT_WEBKIT=1 npm run test:trips:browser -- --workers=2
```

The command builds the production application with fixed content. It starts preview on `127.0.0.1:4175`.
It removes the temporary build directory when the tests finish.
The default projects use desktop and phone Chromium. CI also enables iPhone WebKit.
Host library installation can require administrator permission.
A missing library is a setup failure, not a passing behavior check.

To include desktop Firefox:

```bash
npx playwright install firefox
PLAYWRIGHT_FIREFOX=1 npm run test:trips:browser -- --project firefox --workers=2
```

`PLAYWRIGHT_FIREFOX_EXECUTABLE` can select an alternative Firefox test executable.
Use it only when the bundled browser cannot start on the host.
The executable must support Playwright's Firefox protocol.

Firefox can retain incorrect page bounds after an interactive map paints.
Also run the horizontal scrolling regression in a visible browser window:

```bash
PLAYWRIGHT_FIREFOX=1 npm run test:trips:browser -- \
  --project firefox --headed --grep 'horizontal scrolling' --workers=1
```

## Failure evidence

CI uploads `browser-test-failures` after a browser check fails.
The available files remain downloadable for seven days.
Both browser suites capture traces and screenshots for failed tests. A retry is not required.
Browser setup failures can lack screenshots.
The artifact also includes available error contexts.
Download and extract the artifact. Open a trace with:

```bash
npx playwright show-trace path/to/trace.zip
```

## Regression coverage

| Area | Required behavior |
| --- | --- |
| Day maps | Use explicit track and stop assignments. Preserve selection during loading, reset, suspension, and failure. |
| Map controls | Update stop visibility immediately. Preserve the setting in previews and after retry. |
| Input | Restore keyboard feedback after pointer exit. Keep keyboard focus across preview replacement. |
| Dismissal | Close day popups with Escape. Clear day selection only when dismissal applies to that map. |
| Recovery | Restore the saved camera. Ignore callbacks from replaced maps. Retain usable previews and downloads. |
| Resources | Release distant maps. Keep maps active during keyboard interaction and fullscreen use. |
| Layout | Prevent horizontal scrolling after maps paint. Keep single portraits within the text column. Preserve panorama proportions and reserved image height. |
| Photos | Select suitable responsive sources. Wrap long captions within each photo. Support mouse, touch, and keyboard controls. Restore focus after closing. |
| Animations | Defer video loading, retain posters and attribution after failure, honor reduced motion, and preserve user pause choices across visibility changes. |
| Content | Retain literal captions, article metadata, return filters, country and region filters, and existing geographic tag links. |

Panorama checks run with default scrollbars and visible classic scrollbars.
Desktop Chromium must reserve 15 CSS pixels in the classic-scrollbar case.
The scrollbar fixture preserves configured executables, arguments, and other launch options.
It does not change Firefox or WebKit launch options.

Photo edges use the root element's layout box, independently of body and article widths.
Root `clientWidth` can include an empty scrollbar gutter ([Chromium implementation note](https://issues.chromium.org/issues/40087305)).
A phone regression narrows the body and verifies that the measurement still uses the page boundary.

Inline day maps use clicks, keyboard activation, and touch in separate cases.
Each input runs with normal motion and reduced motion. Touch cases require a phone project.
The cases check painted markers, stop lists, route colors, and camera bounds.
Repeat the layout and input checks with:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:trips:browser -- \
  --grep 'panoramas fill|panorama measurements|inline maps retain' --repeat-each=3 --workers=2
```

Check launch-option inheritance and failure evidence without starting browsers:

```bash
npx vitest run scripts/__tests__/tripBrowserFixtures.test.ts scripts/__tests__/browserFailureEvidence.test.ts
```

The map action test delays tile responses until after a full-route reset.
This checks that a later load does not restore the initial stop.
Repeat that browser check with:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:trips:browser -- \
  tests/trips/reading.spec.ts --grep 'map actions appear' --repeat-each=3 --workers=2
```

Run the focused map unit tests with:

```bash
npx vitest run src/test/tripMapView.test.tsx src/test/tripRouteMap.test.tsx \
  src/test/tripMapBlock.test.tsx src/test/tripMapBlockSelection.test.tsx \
  src/test/tripBlockRecovery.test.tsx src/test/tripMapDayFocus.test.tsx
```

Renderer failure tests cover map errors and WebGL context loss.
They retain the selected day after retry and reject late events from a removed map.
Replacing day definitions must clear a previous renderer failure without another route request.
Selecting a different day must retain the error until the reader retries.
The browser test loses a real WebGL context. It checks route pixels after retry.

Photo unit tests also check recovery after changes to responsive sources or image slot width.
Adaptive gallery tests check proportional pairs, balanced rows, portrait spans, panorama rows, and exact gutter geometry.
Browser checks measure both image frames and image content.
They check hover, keyboard focus, visible scrollbars, image failure, expansion, and focus during viewport changes.
Touch cases include long captions and unbroken text at phone and tablet widths.
Source checks use fresh contexts with device pixel ratios of 1, 2, and 3.
They compare the selected resolution with the rendered width and available sources.
Separate cases remove `auto` before source selection to exercise the explicit `sizes` fallbacks.
Run these checks with:

```bash
npx vitest run src/test/tripGalleryLayout.test.ts src/test/tripStory.test.tsx
npm run test:e2e -- tests/e2e/trip-galleries.spec.ts
PLAYWRIGHT_WEBKIT=1 npm run test:e2e -- tests/e2e/trip-galleries.spec.ts tests/e2e/post-rendering.spec.ts
```

`PLAYWRIGHT_WEBKIT=1` adds desktop WebKit to the fixture suite.
The production trip suite uses iPhone WebKit with the same setting.
Performance measurement tests require Chromium's DevTools Protocol. The fixture suite skips those tests in WebKit.
Color checks resolve the expected CSS token in each browser.
This avoids failures caused by different decimal precision in computed color values.
On macOS, Safari uses Option+Tab to include links in keyboard traversal.

The standard fixture command builds flight data and can download state boundaries.
For gallery checks without that download, start Vite in a separate terminal:

```bash
npx vite --host 127.0.0.1 --port 4184 --strictPort
```

Then run the fixture tests against that server:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4184 PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_WEBKIT=1 \
  npx playwright test tests/e2e/trip-galleries.spec.ts tests/e2e/post-rendering.spec.ts --workers=2
```

Stop Vite after the tests finish.

Page tests use fixed post metadata and trip summaries.
Development-status tests use fixed publication, source, and asset states.
Tests must not depend on a previous content import.

The hero tests check photo selection, wraparound, viewer order, focus return, and image failure recovery.
They also check title placement, reserved height, responsive image sizes, and reduced motion.
Single-photo checks measure portrait, landscape, and explicit panorama widths from 320 to 1440 pixels.
They check reserved image height after failure and responsive sources on high-density displays.
Caption checks use long words with pointer and touch input in Chromium and WebKit.
The unit tests also check viewer cleanup when the photo or link setting changes.
Country fact links must retain their country. Region fact links must retain both their country and region.

Post filter tests use a separate browser fixture with the application styles.
Its container must have an explicit full width, as the application layout does.
A container that shrinks to its visible links can cause repeated measurement changes.
The browser cases check resizing, independent expansion, selected regions, and long labels at 320 pixels.
Unit tests check observer cleanup, missing browser APIs, topic precedence, and ambiguous geographic names.

Run the post filter checks with:

```bash
npx vitest run src/test/blogRegions.test.ts src/test/PostRegionFilters.test.tsx src/test/blogPages.test.tsx
npm run test:e2e -- tests/e2e/post-regions.spec.ts
```

Run animation validation and playback tests with:

```bash
npx vitest run scripts/__tests__/tripAnimations.test.ts src/test/tripAnimation.test.tsx \
  src/test/tripRegistries.test.ts
```

These tests check media origins, trip directories, file types, fingerprints, playback, and reduced motion.
They also check browsers without `IntersectionObserver` and CDN URLs during development.
Playback tests mock the media API. They do not prove that a browser can decode a specific MP4 file.

Check the application player and bundled Kalaloch animation in Chromium and WebKit:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:e2e -- tests/e2e/trip-animation.spec.ts tests/e2e/trip-media.spec.ts
```

Player checks use the real React component, application styles, and bundled video.
They cover deferred requests, pointer pause, keyboard playback, touch controls, reduced motion, and HTML responses at video URLs.
Move the pointer over the frame to reveal desktop controls. Keyboard focus also reveals them.
These fixtures require the local development server.
Use the separate asset test to check deployed files after publication:

```bash
PLAYWRIGHT_BASE_URL=https://www.rsmb.tv PLAYWRIGHT_SKIP_WEB_SERVER=1 \
  npx playwright test tests/e2e/trip-media.spec.ts
```

These checks reject HTML responses, including successful HTML rewrites at video URLs.
The asset test checks HTTP types, MP4 file bytes, poster delivery, and browser decoding.
It does not test the deployed article or prove that hosting rewrite rules match Terraform.

## JavaScript budgets

Each budget test uses a separate browser context.
It captures script requests until the initial route content is visible.
It reads the captured responses without requesting each script again.
It counts each complete script URL once, including its query string.
It includes extensionless scripts and `.js` or `.mjs` preload requests.
It compresses each response body with gzip level 6, then adds the sizes.
This measures unique bundle size. It does not measure network transfer or cache savings.
Missing responses, failed responses, and an empty script set fail the test.

| Route | Gzip size must be less than |
| --- | --- |
| `/` and `/posts` | 125,000 bytes |
| `/blog/reading-test` | 185,000 bytes |
| `/trips/coastal-test` | 190,000 bytes |

Run the budget checks with:

```bash
npx vitest run scripts/__tests__/tripBrowserBudget.test.ts --coverage \
  --coverage.include=scripts/trip-browser-budget.ts
PLAYWRIGHT_WEBKIT=1 npm run test:trips:browser -- \
  --grep 'reading routes exclude' --workers=2
```

Keep the limits when you change map loading or worker delivery.
Use the [repository guide](../../README.md#testing-notes) for coverage comparison rules and other test commands.
