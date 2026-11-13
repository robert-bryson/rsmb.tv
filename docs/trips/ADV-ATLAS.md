# ADV Atlas

ADV Atlas connects motorcycle trip reports through a shared route map.
Open `/projects/adv-atlas/map` to browse the collection.
The project entry opens this explorer directly.

Select a trip to show route-colored dots with a broad black halo at recorded day breaks.
Each dot marks the end of an authored day's final track.
The final day with recorded tracks uses the end pin instead.
Multiple recordings or disconnected parts within one day do not add extra dots.
The dots have no labels or additional controls; day details remain in the trip report.
Day metadata loads on selection. Missing metadata leaves the route usable without dots.
Black square pins mark the selected route's recorded start and end.
The start uses a play symbol. The end uses a stop square. Both symbols use the trip color.
The pins share the selected route's crisp black halo color and opacity.
Pins sit directly above their endpoints.
When they overlap, their bodies move apart. Their pointers retain the actual coordinates.
Markers have no visible labels. They do not intercept map clicks or gestures.

## Trip panel

The panel has three states.

| State | Desktop | Phone |
| --- | --- | --- |
| Collapsed | Only the two side arrows remain | Only the two bottom arrows remain |
| Compact | A panel up to 360 pixels wide | A short bottom sheet |
| Expanded | Two-thirds of the screen, beside the map | Half the available height, with the map above |

The initial view is compact.
Use the single arrow to open the compact panel, collapse it, or reduce an expanded panel.
Use the double arrow to open the expanded panel or collapse it.
Drag either arrow to resize the panel. Release it to select the nearest panel size.
Press Escape during a drag to restore its starting size.
Resizing the window or leaving the window also cancels a drag.
These actions retain the camera. Size changes between card views also retain the visible result position.
Closing the panel moves focus to its surviving arrow control.
Reduced-motion settings disable the slide animation.

Expanded view offers **Cards** and **Table**.
Cards include descriptions, dates, exact mileage, riding days, motorcycles, locations, and report links.
The table supports column sorting, trip selection through titles, and report links.
Select **Customize table columns** to show, hide, or reorder columns.
On short screens, column settings float over the panel or map to retain usable space.
Trip names remain visible and first. They stay pinned during horizontal scrolling.
Drag a column handle to change its order.
With a keyboard, press Space or Enter to pick up the handle.
Use Up, Down, Home, or End to move it. Press Space or Enter to finish.
Press Escape to restore the previous order. Press Escape again to close the settings.
Select **Reset columns** to restore the default order and visibility.
Column choices remain in this browser's local storage. Shared URLs do not contain them.
Leaving column settings with Tab closes the editor, including when focus leaves the document.
Leaving the browser window also closes the editor.
Resizing the window closes the editor and returns focus to **Customize table columns**.
Locations show up to two lines. Select **See all** to expand them, or **See less** to collapse them.
Country names use bold text. Country and region names highlight on hover and keyboard focus.
Select a name to filter matching trips and frame that place on the map.
This replaces the previous location filter and clears trip selection and selected-only mode.
It retains year, riding-day, distance, sorting, and presentation choices.
Horizontal table scrolling stays inside the panel.
Compact mode uses cards and retains the preferred expanded presentation.
Changing between cards and table starts at the top so the table headings remain visible.

Icon controls show explanatory tooltips on keyboard focus and after a short pointer pause.
Keyboard focus takes priority when scrolling moves another control under the pointer.
Tooltips update when browser history changes the control's action or state.
Press Escape to dismiss a tooltip. Touch input and dragging dismiss it automatically.

## Sort and filter

Sort by trip date, riding days, miles, location, or title.
The initial order is trip start date, newest first.
Table headers and the sort menu use the same order.
Location order compares country names, then region names.
Missing facts sort last in both directions. Report publication dates do not replace missing trip dates.

Select **Filters** to choose a trip year, riding-day range, distance range, or location.
Select **Apply filters** to commit the form.
Unapplied changes do not affect the map or results.
Invalid ranges leave the applied filters unchanged and identify the affected input.
Sorting and the selected-trip toggle apply immediately.

The year picker lists only years with recorded trips, newest first.
A trip spanning two years appears in both years.
Riding-day and distance choices use familiar ranges. Ranges without trips are omitted.
Choices use the complete available collection, so applying another filter does not remove options.
Riding-day and mileage endpoints are also inclusive.
Riding days must be whole numbers. Mileage comparisons use the recorded number before display formatting.
Choose **Any year**, **Any number of days**, or **Any distance** to remove that limit.
Unknown facts remain visible until an active filter needs that fact.
Each chosen range counts as one filter and has one removal button.
Existing shared links retain precise dates and numeric bounds, including values outside the suggested ranges.
The form shows both dates for a custom date range.
An open date endpoint shows **Any**.
These values remain unchanged until you choose another option.

Location choices match any selected country or region.
**Any region in Canada** includes Canadian trips without a recorded province.
Selecting a province replaces that country's broader choice.
Region keys include their country, so identical names cannot select unrelated regions.
Legacy locations use the existing geography adapter. Ambiguous countries remain unassigned.

Cards, table rows, map geometry, tooltips, and shared-road choices use the same filtered trip set.
Counts refer to trips, including journeys with several reports.
Route failures remain results with report links and independent retries.
A late route response cannot add an excluded trip to the map.
Route hit tests also reject excluded or unavailable routes while the renderer processes a source update.

Applied filters have removal buttons and a **Clear filters** action.
Clearing filters also clears selected-only. It retains selection, sort, presentation, and camera.
If a selected trip falls outside the filters, its warning remains visible.
The excluded route does not enter the map. Use **Clear selection** or change the filters.

### Shared URLs

Selection, committed filters, sorting, panel size, result presentation, and camera values are shareable.
Applying filters creates one history entry. Browser Back restores the previous committed results.
Other changes replace the current entry. Panning and zooming update the URL when movement ends.
Dragging does not write an entry for each animation frame.
Presentation changes and camera updates retain the existing filters.

| Parameter | Meaning | Example |
| --- | --- | --- |
| `from`, `to` | Inclusive trip-date overlap | `from=2025-01-01&to=2025-12-31` |
| `daysMin`, `daysMax` | Inclusive riding-day bounds | `daysMin=3&daysMax=10` |
| `milesMin`, `milesMax` | Inclusive mileage bounds | `milesMax=1500` |
| `country` | Country-wide choice; can repeat | `country=US&country=CA` |
| `region` | Country-qualified region; can repeat | `region=CA%2Fbritish-columbia` |
| `sort` | Sort key; default `newest` is omitted | `sort=miles-asc` |
| `panel` | Panel size | `panel=collapsed`, `compact`, or `expanded` |
| `results` | Preferred expanded presentation | `results=cards` or `table` |
| `camera` | Longitude, latitude, zoom, bearing, and pitch | `camera=-123.1%2C48.2%2C7.5%2C0%2C0` |

Other sort keys are `oldest`, `days-asc`, `days-desc`, `miles-desc`, `location-asc`, `location-desc`, `title-asc`, and `title-desc`.
Invalid sort keys use the default order.
Invalid filter values show an error and no results. Clear or correct them to continue.
Invalid camera or presentation values use the normal initial view.
Camera links round coordinates to six decimal places, zoom to four, and bearing and pitch to two.
Longitude and bearing use the interval from −180 degrees to less than 180 degrees.

### Share control

Select **Share map** in the map toolbar to share the current view.
The control captures the current camera, including movement that has not ended.
It uses the device's [native sharing interface](https://www.w3.org/TR/web-share/) when available.
Cancelling native sharing ends the action.
If native sharing is unavailable or fails, the control tries the [Clipboard API](https://www.w3.org/TR/clipboard-apis/).
Successful copying shows **Link copied**.
If clipboard access is unavailable or denied, a selected text field provides the link for manual copying.
Select **Close** or press Escape to close that field and return focus to the share control.

Map controls and panel controls use the same dark surfaces, borders, corner radius, and violet focus indicators.
Zoom, fullscreen, share, and overview controls have 44-pixel targets.
Short maps place zoom controls side by side, with fullscreen beside them and Share below.
Camera fitting limits padding to retain visible route space in short or narrow maps.
The overview control uses a circular-arrow icon. Its accessible name and tooltip identify **Fit results** or **Zoom to all trips**.

## Selection and navigation

| URL | Result |
| --- | --- |
| `/projects/adv-atlas/map` | Show the collection overview |
| `/projects/adv-atlas/map?trip=boise-2024` | Select and frame one trip |
| `/projects/adv-atlas/map?trip=boise-2024&view=selected` | Show only the selected trip |

The former `/projects/motorcycle-trips` routes redirect to the explorer.
Redirects retain query parameters, fragments, and return state.

Select a trip title, card background, or route line to select a trip.
Shared roads show named route choices.
The choices stay within the map. Scroll the choices when their content exceeds the available space.
Pointer and keyboard previews highlight routes without changing the selection or camera.
Their popups attach to visible track segments.
If the entire route is off screen, the popup stays near the closest map edge and points toward the track.
Placement uses projected geometry, so map rotation changes the indicated direction.
It retains gaps between disconnected tracks and includes segments that cross the view with both endpoints outside it.
Popups follow camera movement and changes to the map UI.
Placement measures the label and pointer, then excludes the trip panel, panel handle, map controls, attribution, and open map overlays.
It compares positions on each side of the track and at other visible points.
It keeps the highlighted track clear where space permits. When all clear positions cover some track, it chooses the position that covers the least track.
Off-screen labels retain their direction when they move around UI.
If the UI leaves no space for the complete popup, the label stays hidden until space is available. The route highlight remains visible.
Keyboard selection closes the choices and focuses the selected card's trip title.
Pointer selection reveals the card without moving keyboard focus.
Reopening the trip panel does not repeat the focus move.
The selected-trip toggle appears only when a valid trip is selected.
Select **Zoom to all trips** to clear the selection and selected-only mode, then frame the collection.
With other filters active, **Fit results** frames the matching collection and retains those filters.
The fit action is disabled until route geometry is available.
Filtering, sorting, and panel resizing do not request another camera fit.
The overview control appears when the selection, filter, or camera differs from the overview.

Select a report link to read the full story.
Its **Back to map** links retain the atlas selection and filter.
Returning restores the camera, panel state, and card position within the same browser tab.
Reloading the report or atlas retains this state.
Report, series, and neighboring-article links retain the originating atlas history key.
Opening another map at the same URL does not replace that report's return destination.
If the originating snapshot has expired, the return frames the selected trip instead of restoring another visit's view.
A copied URL with a camera restores that view, including bearing and pitch.
Without a camera, a fresh visit frames the selected trip or collection.
Explicit URL presentation and camera values take priority over different saved preferences.
Matching saved cameras retain full precision for report returns.
Each browser history entry receives a unique key before the router starts.
Reloads retain that key. Separate direct visits receive different keys, even when their URLs match.
Camera movement updates the saved view in memory before navigation can persist it.

The browser stores up to 40 destination records in `sessionStorage`.
Each saved view normally uses two records: a history key and a return URL.
The URL record supports older report links that do not carry a history key.
The state contains camera values, panel size, expanded presentation, and card scroll position.
Existing Boolean panel records remain supported: open becomes compact, and closed becomes collapsed.
Stored values are validated before use. Invalid records are ignored.
If storage is unavailable, navigation uses an in-memory fallback. Reload restoration then cannot work.

## Content and recovery

Production includes published report-backed trips.
Development also includes drafts and incomplete reports, with amber labels.
Cards without valid manifests retain report links. Their route controls remain disabled.
Hosted development builds retain CDN asset URLs.
Local Vite uses prepared assets under `public/data/trips/`.

Each route has an independent loading state and retry action.
Map failures leave report cards available.
Renderer retries retain the selected trip and saved camera.
Retries also retain pending camera fits. Delayed route data completes the original fit request.
Manual movement still cancels that request. A later explicit selection can request another fit.
Fullscreen includes the cards, route choices, and recovery controls.
Renderer retries retain the fullscreen button's action, label, and icon.
If fullscreen ends during a failed retry, the next renderer creates a fresh fullscreen control.

### Geographic bounds

Geographic zoom bounds come from [Natural Earth v5.1.2](https://github.com/nvkelso/natural-earth-vector/tree/v5.1.2/geojson).
The lookup includes country bounds and all United States and Canadian first-level regions.
It uses the shortest longitude interval for places crossing the date line.
Natural Earth publishes these datasets in the [public domain](https://www.naturalearthdata.com/about/terms-of-use/).
Unknown region names retain filtering and frame matching routes instead.

Run this command from the repository root to regenerate the lookup:

```bash
node scripts/generate-atlas-geography-bounds.js
```

The command requires network access. Each source request has a 30-second deadline, including its response body.
Source failures leave the existing lookup unchanged.
Generation and map lookup use the same name normalization.
Normalization removes accents from lookup keys. Filter keys retain the authored region name.
Review the generated diff before you commit it.

## Code ownership

| Module | Responsibility |
| --- | --- |
| `scripts/trip-content-plugin.ts` | Validate publication data and emit small trip summaries |
| `src/features/trips/atlas/tripAtlasEntries.ts` | Group reports and order trip cards |
| `src/features/trips/atlas/tripAtlasBrowser.ts` | Validate browse URLs, filter summaries, normalize locations, and sort results |
| `src/features/trips/atlas/tripAtlasUrlState.ts` | Validate shared cameras and presentation values |
| `src/features/trips/atlas/useAtlasUrlState.ts` | Compose URL changes and preserve history state and fragments |
| `src/features/trips/atlas/TripAtlasShare.tsx` | Share the current view and provide copy fallbacks |
| `src/features/trips/atlas/TripAtlasPanel.tsx` | Manage the drawer controls, filter disclosure, and result-position anchors |
| `src/features/trips/atlas/useAtlasPanelDrag.ts` | Resize the panel and cancel interrupted pointer gestures |
| `src/features/trips/atlas/TripAtlasFilters.tsx` | Edit filter drafts and show applied filters |
| `src/features/trips/atlas/tripAtlasFilterOptions.ts` | Build populated presets and label exact shared ranges |
| `src/features/trips/atlas/TripAtlasResults.tsx` | Present matching trips as cards or a native sortable table |
| `src/features/trips/atlas/TripAtlasLocations.tsx` | Limit visible locations, expand them, and expose place actions |
| `src/features/trips/atlas/tripAtlasGeography.ts` | Apply qualified location filters and resolve geographic bounds |
| `shared/atlasGeography.ts` | Normalize geographic lookup names for generation and runtime use |
| `scripts/generate-atlas-geography-bounds.js` | Download pinned source data and generate geographic bounds |
| `src/features/trips/atlas/tripAtlasTableColumns.ts` | Define columns and validate saved order and visibility |
| `src/features/trips/atlas/TripAtlasColumnSettings.tsx` | Open column settings and retain usable panel space |
| `src/features/trips/atlas/TripAtlasColumnChoices.tsx` | Reorder columns with pointer or keyboard input |
| `src/features/trips/atlas/TripAtlasSort.tsx` | Present sort choices and restore trigger focus |
| `src/features/trips/atlas/TripAtlasViewToggle.tsx` | Select the expanded result presentation |
| `src/features/trips/atlas/AtlasControlTooltips.tsx` | Explain controls and synchronize visible and accessible hints |
| `src/features/trips/atlas/tripAtlasMarkers.ts` | Resolve day breaks and endpoints from authored recording order |
| `src/features/trips/atlas/tripAtlasView.ts` | Build atlas URLs and combine route features |
| `src/features/trips/atlas/tripAtlasSession.ts` | Validate, copy, bound, and persist tab state |
| `src/blog/postReturnDestination.ts` | Validate article return destinations and retain source visit identity |
| `src/utils/browserHistory.ts` | Give direct browser visits unique keys that survive reloads |
| `src/pages/AdvAtlas.tsx` | Coordinate cards, route readers, URL state, and page lifecycle |
| `src/features/trips/atlas/TripAtlasMap.tsx` | Manage MapLibre rendering, camera fitting, and map input |
| `src/features/trips/atlas/atlasTooltipPlacement.ts` | Find visible track anchors and directional anchors for off-screen routes |
| `src/features/trips/atlas/atlasTooltipGeometry.ts` | Clip projected segments and compare screen geometry |
| `src/features/trips/atlas/atlasTooltipLayout.ts` | Choose measured popup bounds that clear UI and minimize route coverage |
| `src/features/trips/atlas/atlasTooltipObstacles.ts` | Measure map UI and observe layout changes |
| `src/features/trips/atlas/AtlasFullscreenControl.ts` | Keep the fullscreen icon correct after renderer replacement |

Use the [trip testing guide](TESTING.md#adv-atlas) for regression commands and required behavior.
Use [TODO.md](../../TODO.md#browser-and-performance-checks) for incomplete work.
The dated [research report](../reviews/2026-10-30-adv-atlas-research.md) records the original design decisions.
The [browsing research](../reviews/2026-10-31-adv-atlas-browsing-research.md) compares drawer, filtering, sorting, and accessibility guidance.
