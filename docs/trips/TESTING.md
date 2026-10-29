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

## Regression coverage

| Area | Required behavior |
| --- | --- |
| Day maps | Use explicit track and stop assignments. Preserve selection during loading, reset, suspension, and failure. |
| Map controls | Update stop visibility immediately. Preserve the setting in previews and after retry. |
| Input | Restore keyboard feedback after pointer exit. Keep keyboard focus across preview replacement. |
| Dismissal | Close day popups with Escape. Clear day selection only when dismissal applies to that map. |
| Recovery | Restore the saved camera. Ignore callbacks from replaced maps. Retain usable previews and downloads. |
| Resources | Release distant maps. Keep maps active during keyboard interaction and fullscreen use. |
| Layout | Prevent horizontal scrolling after maps paint. Preserve panorama proportions and reserved image height. |
| Photos | Select suitable responsive sources. Support mouse, touch, and keyboard controls. Restore focus after closing. |
| Content | Retain literal captions, article metadata, return filters, country tags, and region tags. |

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

Photo unit tests also check recovery after changes to responsive sources or image slot width.
Page tests use fixed post metadata and trip summaries.
Development-status tests use fixed publication, source, and asset states.
Tests must not depend on a previous content import.

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
