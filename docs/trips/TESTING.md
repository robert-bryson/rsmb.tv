# Trip tests

Use fixed content for automated checks. Do not require Google access or published trip assets.
The fixtures are in `tests/fixtures/trip-content/`.
Trip MDX fixtures include `format: trip` frontmatter, as imported stories do.

## CI bundle check

CI runs this command for pushes and pull requests to `main`:

```bash
npx vite build --mode trip-test
```

This mode selects tracked content fixtures and retains production publication rules.
Missing registries, published story bodies, and published manifests stop the build.
Draft metadata, story bodies, manifests, and HTML pages remain excluded.
The command requires no Google access or CARTO credentials.

The CI regression runs the workflow command in a temporary copy without generated blog content or local environment files.
It checks article metadata, crawler directives, compiled stories, and draft exclusion.
It also checks workflow triggers and the absence of secret references in the build environment.

This check validates application compilation and generated article HTML.
Live Google content, public assets, and deployed key authorization require separate checks.
Amplify imports published content through `npm run build` and requires its configured `CARTO_API_KEY`.

## Browser setup

Install the browser files before the first run:

```bash
npx playwright install --with-deps chromium webkit
PLAYWRIGHT_WEBKIT=1 npm run test:trips:browser -- --workers=2
```

The command builds the production application with fixed content. It starts preview on `127.0.0.1:4175`.
It removes the temporary build directory when the tests finish.
The default projects use desktop and phone Chromium. CI also enables iPhone WebKit.
CI runs the separate heading, gallery, and post-link fixtures in Chromium and desktop WebKit.
Verify renderer fixes on Linux as well as macOS. WebKit can paint differently on each platform.
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
Trip CI stops on its first failure and emits GitHub annotations.
The complete suite still runs when checks pass.
Download and extract the artifact. Open a trace with:

```bash
npx playwright show-trace path/to/trace.zip
```

## Regression coverage

### Trip content

Run the trip authoring checks without Drive, Google access, or public assets:

```bash
npx vitest run scripts/__tests__/tripContent.test.ts scripts/__tests__/tripManifestAuthoring.test.ts
```

These checks validate tracked manifests, daily photo assignments, responsive filenames, gallery counts, and shortcode references.
The PCH checks include the separate `{{trip-photo:20241003-150610}}` placement.
That photo remains outside the October 3 gallery to prevent duplication.
Recovered-trip checks compare the source inventory with tracked manifests.
They check the Mississippi–Wisconsin photo dates, responsive images, gallery placements, and map headings.
They also check all 37 calendar days and recorded-track assignments across the three 2026 outlines.
The 2026 manifest now has a July 17 hero and uses the `.json` suffix.
Its three outlines must expand without unresolved shortcodes and place each selected photo once across the series.
Schema validation permits local previews. The Sheet publication flag still controls production inclusion.
Invalid-reference cases check duplicate IDs, shared tracks, missing galleries, and inherited object properties.
The Drive outline remains an authoring source outside Git.
Validate its shortcodes against the manifest after you change media placements.

| Area | Required behavior |
| --- | --- |
| Day maps | Use explicit track and stop assignments. Preserve selection during loading, reset, suspension, and failure. |
| Map controls | Update stop visibility immediately. Preserve the setting in previews and after retry. |
| Input | Restore keyboard feedback after pointer exit. Keep keyboard focus across preview replacement. |
| Dismissal | Close day popups with Escape. Clear day selection only when dismissal applies to that map. |
| Recovery | Restore the saved camera. Ignore callbacks from replaced maps. Retain usable previews and downloads. |
| Resources | Release distant maps. Keep maps active during keyboard interaction and fullscreen use. |
| Layout | Prevent horizontal scrolling after maps paint. Keep single photos within the text column. Preserve panorama proportions and reserved image height. |
| Photos | Select suitable responsive sources. Wrap long captions within each photo. Support mouse, touch, and keyboard controls. Restore focus after closing. |
| Animations | Defer video loading, retain posters and attribution after failure, honor reduced motion, and preserve user pause choices across visibility changes. |
| Content | Retain literal captions, article metadata, return filters, country and region filters, and existing geographic tag links. |

### Panorama layout

Panorama checks run with default scrollbars and visible classic scrollbars.
Desktop Chromium must reserve 15 CSS pixels in the classic-scrollbar case.
The scrollbar fixture preserves configured executables, arguments, and other launch options.
It does not change Firefox or WebKit launch options.

Photo edges use the root element's layout box, independently of body and article widths.
Root `clientWidth` can include an empty scrollbar gutter ([Chromium implementation note](https://issues.chromium.org/issues/40087305)).
A phone regression narrows the body and verifies that the measurement still uses the page boundary.
Overflow checks allow the root scroll width to exclude that gutter.
They also compare the body scroll width with the independent page boundary.
An oversized body verifies the DOM measurements.
A separate case places five pixels of content overflow inside a 15-pixel gutter.
Both cases use the same overflow guard as the panorama layout checks.

### Map input and activation

Inline day maps use clicks, keyboard activation, and touch in separate cases.
Each input runs with normal motion and reduced motion. Touch cases require a phone project.
The cases check painted markers, stop lists, route colors, and camera bounds.
Preview activation checks deliver a real visibility entry while a day button is pressed.
Each check uses pointer input or the Space key.
The module loads after the click, during the press, or before the press through another map.
An additional case starts loading with **Explore interactive map** before pressing a day.
Another case activates automatically while **Explore interactive map** is pressed.
The checks verify that the original button remains until release.
They then verify selection in the interactive map and keyboard focus after replacement.
This detects lost clicks from replacing a pressed button, including when the module is already loaded.
Run these checks with:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:trips:browser -- \
  tests/trips/day-maps.spec.ts --grep 'preview day activation' --workers=2
```

Automatic activation loads the module while a preview control is pressed.
It delays replacement until the native click completes.
Cancellation, release outside the map, loss of keyboard focus, and window blur also permit replacement.
Unit tests check these exit paths and suspension during a pending load.
They also check activation without `IntersectionObserver` and releases from a second touch pointer.
Repeated exploration retains the current boundary. Only a failed-map retry replaces it.

Recovery, reset, and camera restoration checks move the pointer outside the map before comparing pixels.
This excludes intentional hover styling from those comparisons.
Repeat the layout and input checks with:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:trips:browser -- \
  --grep 'panoramas fill|panorama measurements|panorama overflow|inline maps retain|stops repaint while' --repeat-each=3 --workers=2
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
  src/test/tripMapBlock.test.tsx src/test/tripMapBlockActivation.test.tsx \
  src/test/tripMapBlockSelection.test.tsx \
  src/test/tripBlockRecovery.test.tsx src/test/tripMapDayFocus.test.tsx
```

Renderer failure tests cover map errors and WebGL context loss.
They retain the selected day after retry and reject late events from a removed map.
Replacing day definitions must clear a previous renderer failure without another route request.
Selecting a different day must retain the error until the reader retries.
The browser test loses a real WebGL context. It checks route pixels after retry.
Maps request one additional frame after style changes or trip geometry updates render.
Pending raster requests do not block this frame.
This prevents Linux WebKit from retaining stale marker pixels after visibility updates.
The delayed-basemap case holds Light tile responses while checking stop markers.
It releases those responses after the checks finish, including after a failure.
Unit tests use MapLibre's event dispatcher to check coalescing, repeated render events, and listener removal.
They also reject stop callbacks from replaced renderers.

### Photos and galleries

The image processor uses real encoders in its tests.
The largest image test has a 20-second limit for slower or shared machines.
Other unit tests retain their normal limits.
Manifest tests reject mixed aspect ratios, duplicate reports, invalid dimensions, and malformed viewer records.
They also permit one pixel of rounding and a native-only viewer set.
Local URL tests distinguish the media host from lookalike hosts and embedded query values.

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

### Articles and filters

Importer tests compile the generated document and render its HTML.
They check first-line indents, exported tab spaces, stylesheet order, and safe inline formatting.
Browser tests measure the first and wrapped lines at desktop and phone widths.
The checks also compare paragraph color, line height, and spacing.

Page tests use fixed post metadata and trip summaries.
Development-status tests use fixed publication, source, and asset states.
Tests must not depend on a previous content import.

The [metadata guide](../site-metadata.md) covers crawler HTML, canonical paths, redirects, and navigation cleanup.
Its browser suite checks both JavaScript-disabled requests and React navigation with the same production fixtures.

The hero tests check photo selection, wraparound, viewer order, focus return, and image failure recovery.
They also check title placement, reserved height, responsive image sizes, and reduced motion.
Wait for the `Trip photos` region before measuring the hero.
The loading view also contains the story title and reserves the same CSS space.
A held-module test verifies that footer navigation waits for the story body.
The hero remains usable during that wait.
Single-photo checks measure portrait, landscape, and explicit panorama widths from 320 to 1440 pixels.
Standalone photos and one-photo galleries must match the text column. Explicit panoramas must reach the page edges.
They check reserved image height after failure and responsive sources on high-density displays.
Larger-text checks cover automatic sizing in both engines.
A Chromium check sets the browser's default font to 24px and disables automatic sizing.
It verifies fallback sources for eager photos and galleries from 900 to 2000 pixels.
Page-level root-font overrides require automatic sizing; fallback rem units follow the browser's default font.
Caption checks use long words with pointer and touch input in Chromium and WebKit.
The unit tests also check viewer cleanup when the photo or link setting changes.
Country fact links must retain their country. Region fact links must retain both their country and region.

Chapter checks compile trip MDX with the production remark plugin.
They verify chapter boundaries, h1 precedence, h2 chapters, nested headings, module exports, and Markdown references.
Writing posts retain their existing structure.
Browser checks measure sticky headings at phone and desktop widths.
They verify continuous handoffs, the end of the story, visible navigation, navigation resizing, links, reduced motion, and print layout.
Subsection links must clear both headers after upward jumps and reloads.
The production reading suite also checks chapter grouping, sticky placement, and subsection clearance on an actual trip route.
Short-screen checks return tall h1 and h2 titles to normal flow. Rotation must restore sticky behavior when space permits.
These fixtures first verify that the title and navigation exceed half the screen height.
They repeat that check after increasing the text size.
This keeps the test meaningful when banner spacing changes.
Phone checks also enlarge text to 200% at 320 and 390 pixels.
They use the default font and DejaVu Sans to cover wider word measurements.
Long chapter-title words must wrap within the text column.
Navigation links and table-of-contents controls must remain within the screen.
The contents header can wrap its button onto another row.
The checks verify complete tap targets and collapse/expand behavior without horizontal scrolling.
Header checks change padding and borders without changing the content box.
The feature uses native CSS scrolling. Each post shares one title resize observer and one queued measurement frame.
The site navigation has its own border-box observer. Neither observer adds a scroll handler.
Unit checks cover observer cleanup, missing browser APIs, Strict Mode, and callbacks received after unmount.

```bash
npx vitest run scripts/__tests__/remarkTripChapters.test.tsx src/test/tripChapterHeadings.test.tsx src/test/mdxComponents.test.tsx src/test/tripStory.test.tsx src/test/Layout.test.tsx
PLAYWRIGHT_WEBKIT=1 npx playwright test tests/e2e/trip-headings.spec.ts tests/e2e/trip-galleries.spec.ts tests/e2e/post-rendering.spec.ts
```

The [trip layout quality review](../reviews/2026-11-13-trip-layout-quality-review.md) records reproduced defects and coverage measurements.

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

### Animations

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

## ADV Atlas

Use the [atlas guide](ADV-ATLAS.md) for URLs, navigation behavior, content rules, and code ownership.

Run atlas interactions and article budgets with fixed production content:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:trips:browser -- \
  --workers=2
```

This command runs the complete trip browser suite, including atlas layouts, location actions, column settings, and article budgets.

Run the focused atlas unit checks without network access:

```bash
npx vitest run src/test/tripAtlas*.test.ts* src/test/advAtlas.test.tsx \
  scripts/__tests__/atlasGeographyBounds.test.ts
```

Generator tests use synthetic source data and temporary output files.
They check country-qualified aliases, date-line bounds, large coastlines, invalid geometry, HTTP failures, and request deadlines.
Failed source requests must preserve the previous output file.

The browser checks cover these behaviors:

- Card and map selections agree. Map clicks reveal the selected card.
- **Show only selected trip** appears only after a valid selection. It filters cards and geometry without changing camera values or route colors.
- The `view=selected` filter survives report navigation. Deselecting or selecting **Zoom to all trips** removes it.
- Reports retain their map return link. Returning restores card scroll and camera position, including after a report reload.
- A second visit to the same atlas URL does not replace the first report's return view. Header, footer, neighboring-article, and series links retain that view.
- Reloading the atlas retains its camera, panel size, and result view within the same tab.
- Separate direct visits receive different history keys. A fresh visit frames its requested trip and starts with the normal panel state.
- Shared roads show route choices. Pointer and keyboard previews retain selection and camera position.
- Keyboard choice selection focuses the selected card's trip title. Tab navigation continues from that card.
- Pointer choice selection does not move keyboard focus. Reopening the panel does not repeat an earlier focus move.
- Escape dismisses previews and choices. Dismissing a preview does not clear the selected trip.
- Escape also closes shared-road choices after focus moves to the trip panel or another control outside the map.
- A delayed route does not override a newer selection or manual camera movement.
- Moving before routes load still permits **Zoom to all trips** after loading finishes.
- Fullscreen includes the list, overview button, route choices, and recovery controls.
- Renderer retries retain fullscreen, the selected trip, and the fullscreen button's icon.
- Renderer retries retain pending selection and overview fits until delayed routes load. Manual movement still cancels a pending fit.
- Failed routes retry independently. Renderer failures leave report links available.
- Collapsed, compact, and expanded panels remain keyboard accessible. Collapsed content leaves the tab order.
- Desktop expansion gives the panel two-thirds of the screen. Phone expansion uses half the available height.
- Both panel arrows support dragging and clicks. Escape, window resizing, and lost window focus cancel active drags.
- Safari must cancel a pointer drag with Escape even when the pressed button lacks keyboard focus.
- Panel size, result view, sorting, and filters retain camera values. **Fit results** frames matching routes explicitly.
- Cards and table rows use the same IDs, order, counts, selection, and map results.
- Switching between cards and table exposes the table caption and headings below the sticky toolbar.
- Native table headers expose the active sort direction. Missing facts sort last in either direction.
- Location sorting compares the complete country list before any region names, including trips across borders.
- Column settings retain the Trip heading, validate stored preferences, and restore default visibility and order.
- Column reordering supports keyboard, pointer, touch, cancellation, and scrolling near the list edge.
- Leaving the column editor with Tab closes it, including when focus leaves the document.
- Internal pointer clicks retain the editor, including Safari clicks that leave focus on the document body.
- Window resizing closes a focused column editor and returns focus to its trigger.
- Year and range drafts leave results unchanged until **Apply filters**. Invalid shared ranges remain errors until corrected.
- Year choices come from trip dates, including crossed years. Numeric presets omit ranges without matching trips.
- Presets compare exact source values and include both endpoints. Precise shared bounds remain unchanged when the form opens.
- Custom date choices show both endpoints. An open endpoint shows **Any**.
- Each year or numeric range has one filter count and one removal button that clears both bounds.
- Country and region choices combine with OR. Regions retain their country; country-wide choices include records without regions.
- Copied URLs and browser Back restore committed filters. Excluded selections remain named without adding hidden routes.
- Shared-road choices stay within short and narrow maps. Every choice remains reachable by scrolling.
- Late route responses cannot restore excluded geometry or shared-road choices.
- Selection, panel size, result presentation, panning, and zooming update the URL without adding history entries.
- Camera values change after movement ends. Viewport-only URL changes retain geometry objects and map hit targets.
- Copied links restore the camera, selection, presentation, and filters in a new tab without saved session state.
- Browser Back restores the earlier camera and panel after applying a filter.
- History restoration also works when React skips an intermediate movement URL. Later zoom changes must still update the URL.
- Late camera events cannot overwrite pending panel changes or interrupt report navigation.
- Native sharing supports cancellation. Copying confirms success; unavailable clipboard access exposes a selected manual link.
- Map and panel controls share surface and focus styles. Map targets remain separate and at least 44 pixels wide at 320 pixels.
- Control hints retain keyboard focus priority during scrolling and update after browser history changes.

### Control layout and camera checks

Layout checks use widths of 320, 767, 768, 858, 1023, 1024, and 1754 pixels.
The overview suite also checks the browser project's default width.
Each width runs independently to keep the work within the normal test timeout.
Each case checks compact, expanded, and collapsed panels.
It then fits the routes at that width and checks their painted bounds.

The overview and short-screen suites use the same control check.
It measures each control, map viewport, and trip panel in one browser task.
Controls must have 44-pixel targets, stay inside the map, and clear the panel.
Nine sample points must accept pointer input.
A separate case covers a control corner while leaving its center usable.
The check must reject that obstruction.

The reset case combines panel changes with the full width sequence.
It restores the initial layout and compares painted route bounds after zoom and pan resets.
Component tests check overview visibility, camera rounding, initial animation, pending routes, and resize events.
Resize events must update the comparison without requesting another camera fit.

Short-screen checks use 667 × 375, 320 × 568, 568 × 320, and 568 × 280 viewports.
Direct selected links must frame routes and save cameras with expanded panels in Chromium and WebKit.
All map controls must retain complete 44-pixel targets after expansion or rotation.
Column settings must retain usable rows in short sheets and remain inside the atlas during fullscreen.
At 320 pixels, forms reflow and table scrolling stays inside its wrapper.
Size changes between card views preserve the first visible result. Presentation changes return to the top.
Sticky tools must not obscure focused controls.
WebKit rounds injected pointer positions to integer CSS pixels. Drag measurements allow one pixel for this rounding.
On macOS, use Option+Tab in WebKit checks that traverse buttons or links.
Canvas clicks must avoid the Share button and other map controls.

Run these checks with:

```bash
npx vitest run src/test/tripAtlasMap.test.tsx
PLAYWRIGHT_WEBKIT=1 npm run test:trips:browser -- \
  tests/trips/overview-controls.spec.ts tests/trips/short-viewports.spec.ts --workers=2
```

Add `--repeat-each=3` to repeat the browser checks under load.
Keep the normal timeout. Do not add retries to hide a failure.

### Trip cards and map interactions

Cards use their titles for keyboard route selection and retain filled **Read trip report** links.
The separate **Show route** action is absent from cards and tables.
Long location lists show two lines until **See all**. Hidden names must leave the tab order.
Country names use bold text. Hover and focus highlight individual place actions.
Place actions replace geographic filters and frame geographic bounds instead of complete journeys.
They retain other filters, clear selected-only mode, and work with keyboard input in both result views.
Checks cover accent colors, focus, hover, wrapping, and report navigation.
Hover previews do not select routes or scroll the list.
Phone checks use card taps, route selection, and shared-road choices.
Keyboard panning checks use desktop Chromium.
Report-return checks capture list scroll at link activation, after any browser scrolling needed to expose the link.
Scroll restoration stops on pointer, wheel, touch, or keyboard input.
Queued resize callbacks must not move the page after that input.
Footer-return checks target the named Post navigation region. They cannot select the header link during loading.
They compare the restored position exactly. Measuring before activation can capture a different position.
Fresh-visit checks wait for the initial fit before measuring painted routes.
Fit padding reserves fixed control space. Delayed tiles and attribution must not change the framing.
Camera snapshot checks wait for the saved session to match the current history key after URL replacement.
Atlas maps request one final frame after camera movement to refresh instant pans in Linux WebKit.
The repaint unit check uses MapLibre's event dispatcher to verify coalescing and cleanup.
It covers camera movement, style changes, route updates, and day-break updates. Basemap updates must not request this extra paint.
Hit-testing checks reject excluded or unavailable routes while the renderer still returns their old features.
Shared-road checks verify unique choices, hover priority, and keyboard or pointer selection.
Table border checks sample border centers at integer and half-pixel layout positions.
Lazy-map checks end navigation scroll restoration before automated scrolling.
Route-reset checks move the pointer away before comparing painted bounds. Hover changes the route's stroke width.

### Tooltips and route measurements

Atlas and story maps use the same text-only tooltip factory.
Checks cover safe text, the colored edge, popup reuse, cleanup, and Escape dismissal.
Atlas tooltips add the start month and year below the title.
Both lines share a starting edge, with a 4-pixel gap.
Date-only changes update the existing popup.
Placement measures the native label body and accounts for its pointer.
Browser checks use actual toolbar bounds to reject collisions.
Pixel checks hide the popup and count highlighted route pixels beneath its body. A loop fixture must leave that count at zero.
Dynamic UI checks add, resize, and remove an overlay while a card retains focus.
They verify that the label moves, hides when no position is available, and returns without a camera change.
Obstacle checks exclude hidden UI, retain transparent screenshot targets, and verify observer cleanup.
Layout checks cover alternate anchors, pointer gaps, nearby track points, stable sides, attribution, and small viewports.
Off-screen route checks cover all four edges and four corners in Chromium and WebKit.
They verify the directional pointer, complete popup bounds, and unchanged camera.
Visible-track checks reject a viewport-center fallback when the route midpoint is outside the view.
Geometry checks retain disconnected tracks, crossing segments, and repeated worlds.
Movement checks update the popup direction and reject events from removed renderers.
Desktop wheel checks retain card focus while the route changes from off screen to visible.
Phone projects omit mouse-wheel input; they check all directions, visible segments, and rotation.
See the [tooltip review](../reviews/2026-10-30-adv-atlas-tooltip-hierarchy.md) for the visual decision.
Screenshot helpers hide overlays through opacity. Pointer targets remain in place during measurements.
Route pixel checks also hide endpoint pins, control hints, and share controls.
The screenshot styles disable transitions so MapLibre's marker fade cannot leave partly visible pins.
A colored overlay with an opacity transition verifies stable route measurements and retained pointer targets.
Route screenshots and canvas bounds must describe one stable layout.
The helper waits for container sizing and rejects captures whose bounds change during the screenshot.
This prevents a panel transition from supplying old pixels with new pointer coordinates.
Camera-restoration tests compare the documented URL precision, without relaxing zoom or selection checks.

### Additional regression commands

Run the content, geometry, lifecycle, and publication checks:

```bash
npx vitest run src/test/tripAtlasEntries.test.ts src/test/tripAtlasView.test.ts src/test/tripAtlasSession.test.ts \
  src/test/tripAtlasBrowser.test.ts \
  src/test/tripAtlasFilters.test.tsx \
  src/test/tripAtlasTableColumns.test.ts src/test/tripAtlasMarkers.test.ts \
  src/test/useAtlasPanelDrag.test.tsx src/test/AtlasControlTooltips.test.tsx \
  src/test/tripAtlasUrlState.test.ts src/test/useAtlasUrlState.test.tsx src/test/tripAtlasShare.test.tsx \
  src/test/atlasTooltipPlacement.test.ts \
  src/test/tripAtlasMap.test.tsx src/test/advAtlas.test.tsx \
  src/test/postReturnDestination.test.ts src/test/postNavigation.test.tsx src/test/blogPages.test.tsx \
  src/test/browserHistory.test.ts src/test/AtlasFullscreenControl.test.ts \
  scripts/__tests__/tripContent.test.ts scripts/__tests__/tripManifestAuthoring.test.ts \
  scripts/__tests__/generateFeeds.test.ts scripts/__tests__/amplifyConfig.test.ts
```

Run focused browser checks for the panel, column editor, and control hints:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:trips:browser -- \
  tests/trips/panel-drag.spec.ts tests/trips/panel-tools.spec.ts \
  tests/trips/columns.spec.ts tests/trips/control-tooltips.spec.ts --workers=2
```

### Renderer recovery and publication

Strict Mode must not retain a replaced renderer's default camera.
Manual movement cancels the pending fit for the current selection.
A later explicit fit request must still work.
Programmatic movement must not cancel a pending route fit.
Renderer recovery must retain completed and cancelled requests without completing an outstanding request.
Session checks reload the JavaScript module before reading saved state.
They cover malformed storage, blocked access, full storage, independent snapshots, and bounded history.
Page checks verify `pagehide` saves and listener removal.
Movement checks capture the camera before `moveend` and before parent navigation cleanup.
Late movement callbacks from removed renderers must not change the saved view.
Fullscreen control checks use the installed MapLibre control without a WebGL renderer.
They check its icon, label, and action after replacement and exit.
Native exit during a failed retry must discard the detached control's stale state.
Tests cover standard and WebKit fullscreen properties, plus pseudo fullscreen during renderer replacement.
Failure checks distinguish missing background tiles from route-source and renderer failures.
Retry must preserve the selected trip and camera. Removed renderers must not report later errors or camera changes.

Page checks use fixed metadata. They cover drafts, incomplete reports, multipart reports, and production exclusion.
Cards without valid manifests retain preview links. They do not request routes or affect loading counts and camera bounds.
Real Vite builds check article HTML in production and development modes.
Development shells include incomplete reports and `noindex, nofollow` metadata.
Production shells exclude drafts.
RSS and sitemap checks exclude unpublished records in every mode.
Amplify checks execute the branch condition with a substitute `npm` function.
Only the `dev` branch can select `build:dev`.

Use `npm run build:dev`, then `npm run preview`, to check hosted development behavior locally.
Hosted previews retain CDN URLs. Local Vite uses prepared local assets.

### Route colors and accessibility

Color checks retain assignments across filtering and route arrival order.
Each manifest needs a unique assignment in [the color registry](../../src/features/trips/atlas/tripAtlasColors.ts).
For manual palette review, use Chrome DevTools' vision-deficiency controls.
Check protanopia, deuteranopia, and tritanopia with overview, selection, and filtering.
Named tooltips, card feedback, route choices, and filtering must remain usable when colors converge.

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
