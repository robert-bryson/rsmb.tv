# ADV Atlas browsing research

Date: 2026-10-31.
Reviewed baseline: `7bdb48b`.
Follow-up: camera values, panel size, and result presentation are now shareable. See the [current URL contract](../trips/ADV-ATLAS.md#shared-urls).
The current-constraint observations describe that baseline.
The implemented behavior is documented in the [atlas guide](../trips/ADV-ATLAS.md).
Scope: drawer states, result views, sorting, filters, map agreement, and browser state.
This report records research and recommendations. The final section records implementation checks.
**Evidence** describes source guidance or checked behavior. **Recommendation** identifies design judgments for this atlas.
WCAG Understanding pages explain success criteria. APG examples and design systems provide implementation guidance.

## Current constraints

**Evidence.** The [atlas guide](../trips/ADV-ATLAS.md) requires selection links, report returns, saved cameras, and independent route recovery.
The current panel stores one Boolean state. The session also stores camera values and scroll position.
See [tripAtlasSession.ts](../../src/features/trips/atlas/tripAtlasSession.ts).
The map uses fixed panel padding during fitting. It clears overlap choices when the panel or entries change.
See [TripAtlasMap.tsx](../../src/features/trips/atlas/TripAtlasMap.tsx).
The installed dependency range is MapLibre GL JS `^6.16.0`. See [package.json](../../package.json).

**Evidence.** A trip can contain several reports. Existing entries group reports by trip ID.
The current default order uses trip start dates, with report dates as a fallback.
Geography currently comes from the first report. See [tripAtlasEntries.ts](../../src/features/trips/atlas/tripAtlasEntries.ts).
The [manifest schema](../../shared/tripManifestSchema.ts) requires valid start and end dates for a valid summary.
Riding days, miles, countries, country regions, and legacy regions remain optional.
The [geography adapter](../../src/content/blogRegions.ts) already normalizes region names and retains their country association.

## Drawer and focus

**Evidence.** The APG disclosure pattern uses a button with `aria-expanded` and optional `aria-controls`.
Enter and Space activate it. An arrow can indicate the action.
See [APG disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/).
Modal dialogs make outside content inert and contain keyboard focus.
See [APG modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

**Recommendation.** Use a named results region beside an interactive map. Keep normal page tab order.
Keep the drawer nonmodal. Do not add `aria-modal`, a backdrop, or a focus trap.
Use an explicit state: `collapsed | compact | expanded`.
The collapsed state exposes only the requested arrow button.
Give it the accessible name **Show trips** and a visible focus indicator.
Set `aria-expanded=false` only when collapsed. Both visible sizes use `true`.
Use a separate **Expand trip panel** or **Use compact panel** action for the two visible sizes.
Keep **Collapse trip panel** available in both visible states.
Do not encode all three sizes in `aria-expanded`, which represents visibility.

**Evidence.** WCAG 2.5.7 requires a single-pointer alternative when an action depends on dragging.
Keyboard support alone does not supply that pointer alternative.
See [Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).
The APG splitter describes arrow keys and a value-bearing separator. Its review and example remain incomplete.
See [APG window splitter](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/).

**Recommendation.** Ship explicit size buttons first. Add drag resizing only after a demonstrated need.
Preserve the focused button when its label changes.
Before hiding focused drawer content, move focus to the surviving **Show trips** button.
Opening with that button keeps focus there. Tab then enters the results region.
Preserve existing pointer selection behavior. Reveal its card without moving keyboard focus.
Preserve existing keyboard selection behavior. Reveal the selected result and focus its route action.
Dismiss open choices before processing another Escape action. Preserve the atlas guide's global choice dismissal contract.

## Width, phones, and camera

**Evidence.** WCAG reflow applies at 320 CSS pixels. Maps and data tables can require two-dimensional layout.
This exception does not extend to surrounding forms or individual table cells.
See [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
Author content must not completely obscure a focused control.
See [Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).
WCAG 2.5.8 specifies 24-by-24 CSS pixel targets, with defined exceptions.
See [Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

**Recommendation.** Use a real desktop split layout where panel and map minimum widths both fit.
Start with a 360-pixel compact panel and a 50% expanded panel. Validate these values with actual content.
Use a 44-pixel target for the collapsed arrow and all panel size actions.
On narrow screens, use a full-width results sheet instead of a half-width panel.
Compact shows a short results sheet. Expanded gives results most available height and retains a clear map action.
Give only the table its own horizontal scroll area.
Avoid a tall sticky filter block that consumes the entire phone results sheet.

**Evidence.** MapLibre `resize()` updates the map to its container dimensions.
Default `trackResize=true` observes container changes, including becoming visible after CSS hiding.
See [Map.resize](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#resize).
MapLibre supports per-edge camera padding for fit operations.
See [PaddingOptions](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/PaddingOptions/).

**Recommendation.** Keep the same map instance through panel changes and responsive transitions.
Retain center, zoom, bearing, and pitch. Do not request another fit for a size, sort, or filter change.
Let the installed container observer handle a real split. Call `resize()` only when its observation is insufficient.
Use measured overlay bounds when fitting beneath an overlay. Remove fixed panel padding for a true split.
Avoid counting the panel width twice through both container width and fit padding.
Add **Fit results** as an explicit camera action. Disable it when no eligible route has bounds.
Preserve pending fits, retry behavior, and manual-movement cancellation from the existing atlas contract.

## Cards, table, and ordering

**Evidence.** Carbon identifies grid/table switching as a use for a content switcher.
One view remains selected. See [Carbon content switcher](https://www.carbondesignsystem.com/building-blocks/core/components/content-switcher/guidelines).
APG recommends a native HTML table when possible. Links and buttons within it remain ordinary tab stops.
See [APG table](https://www.w3.org/WAI/ARIA/apg/patterns/table/).
Its sortable example puts buttons inside headers and `aria-sort` on the active header.
Sort icons use distinct shapes and remain hidden from assistive technology.
See [APG sortable table](https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/).

**Recommendation.** Compact uses cards. Expanded offers labeled **Cards** and **Table** choices.
Use native radio controls with one group label, or an equivalent accessible view selector.
Keep preferred expanded presentation when temporarily compact. Do not let a resize discard it.
Expanded cards show description, date range, riding days, miles, motorcycle, geography, and report links.
Missing facts say **Not recorded**. They do not become zero.
Table columns are Trip, Trip dates, Riding days, Miles, Location, and Route.
Use a caption, column headers, report links, and an explicit **Show route** button.
Do not turn the row into a grid widget or make the entire row the only action target.
Keep focus on the view selector when switching. Reveal the selected trip when it is still included.

**Recommendation.** Use one sort contract for the dropdown and sortable table headers.
Support trip date, riding days, miles, and location in both directions.
Default to trip start date, newest first. Do not substitute report publication dates for missing trip dates.
Sort numeric fields using source numbers. Format them only for display.
Always put missing values last, including descending order.
Resolve equal values by trip title, then trip ID. Keep those tie-breakers ascending.
Define location as alphabetical country names, then region names, with each list normalized and sorted.
Label that option **Location A–Z**. It represents names, not distance or route direction.

## Filter application and feedback

**Evidence.** Carbon recommends batch application when users choose several categories or results return slowly.
It describes instant updates as useful for single-category or single-choice interactions.
See [Carbon filtering](https://www.carbondesignsystem.com/building-blocks/core/patterns/filtering).
Scottish Government permits instant desktop updates but recommends explicit application on mobile.
It also specifies removable filter tags and clear-all controls.
See [Scottish Government search filters](https://designsystem.gov.scot/patterns/search-results/search-filters).
Updating content is not automatically a prohibited context change. Unexpected focus or navigation changes require care.
See [WCAG On Input](https://www.w3.org/WAI/WCAG22/Understanding/on-input.html).

**Recommendation.** Use **Apply filters** for the date, riding-day, mile, and geography form on every screen size.
Keep draft values separate from applied filters. Invalid drafts leave the current results unchanged.
Show inline errors for invalid dates, negative values, fractional days, and reversed ranges.
Place Apply after the fields. Enter submits the form. Keep its focus visible after submission.
Sorting, presentation, and **Only selected trip** take effect immediately.
Instant filtering remains viable, but needs valid-input commit rules and phone tests for noticeable updates.

**Evidence.** WAI recommends `fieldset` and `legend` for related form controls.
See [Grouping controls](https://www.w3.org/WAI/tutorials/forms/grouping/).
Native date inputs represent calendar-date strings. Number inputs default to integer steps.
See [HTML date and number controls](https://html.spec.whatwg.org/multipage/input.html#date-state-(type=date)).
Result-count messages can be exposed without moving focus through status semantics.
See [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

**Recommendation.** Label each range **From** and **To** within its named fieldset. State that endpoints are included.
Use native date controls, integer riding-day controls, and mile controls with `step=any`.
Keep date strings as calendar dates. Do not convert filter boundaries through local midnight timestamps.
Show **N of M trips** and a separate route-loading count. Count trip IDs, not reports or route features.
Use one polite status region for committed count updates. Do not announce each rendered card.
Show removable applied-filter chips and **Clear filters** above results. Give removal buttons explicit accessible names.
Keep an applied-filter count and clear action visible when the filter form is closed.
For arrow-only panel collapse, place this summary with the map toolbar instead of adding drawer text.
Clear filters resets applied and draft filters, including selected-only. It preserves selection, sort, layout, and camera.
Keep **Zoom to all trips** as the existing separate overview action. Its broader reset remains explicit.

## Data predicates and geography

**Recommendation.** Compute one canonical filtered trip-ID set before deriving any presentation.
Combine date, riding days, miles, geography, and selected-only with AND.
Use inclusive interval overlap: `trip.end >= from && trip.start <= to`, omitting each absent boundary.
This includes a trip already underway on the first date. Explain it as **Trips that overlap these dates**.
Numeric predicates use `minimum <= value <= maximum`. A blank endpoint is unbounded.
Compare exact mileage values. Show decimal precision when rounding would conceal a boundary mismatch.
Exclude an unknown value only when its dimension has an active filter. Never derive riding days from calendar duration.
Apply all predicates to grouped trip summaries. Multipart reports cannot multiply days, miles, or counts.

**Evidence.** APG mixed-state checkboxes represent partial selection of a defined child group.
See [APG checkbox](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/).
**Recommendation.** Use expandable country groups with ordinary multi-select checkboxes for country or region choices.
Distinguish the country disclosure button from the country-wide checkbox labeled **Any region in Canada**, for example.
Country-wide choice means any trip in that country, including trips without recorded regions.
It does not mean every currently available child checkbox is selected.
Selecting a country-wide choice removes redundant child choices. Selecting a child replaces that country's wildcard.
Combine geography choices with OR: United States OR British Columbia, Canada matches either location.
Within a region choice, match country AND region on the same geography record.
Use country-qualified keys such as `CA/british-columbia`; never filter a region name across unrelated countries.
Prefer summary countries. Use normalized report geography only when summary geography is absent.
Retain unknown legacy locations separately. Do not infer missing countries from route coordinates or ambiguous names.
Build options from all eligible trip metadata. Preserve selected options even when their current result count is zero.
Use country labels from the existing geography adapter.

## URL, selection, and agreement

**Recommendation.** Put committed filters, sort, selected trip, and selected-only in the URL.
Keep drawer size, card/table preference, camera, scroll, and unfinished form drafts out of shared links.
Extend the existing per-history-entry session contract for layout and presentation. Validate and version its records.
Migrate `panelOpen=true` to compact and `false` to collapsed. Preserve independent visits at the same URL.
Use allowlisted sort keys and validated ISO dates, finite numbers, country codes, and qualified region tokens.
Canonicalize parameter order and duplicates. Omit default values. Report ignored invalid filter parameters without crashing.
An explicit Apply creates one history entry. Back restores the previous committed filters and result set.
Opening a copied URL reconstructs its results without requiring another tab's camera or layout state.

**Recommendation.** Render **Only selected trip** only when the selected trip ID is valid.
Clearing selection also clears selected-only. A stale selected-only URL without a valid trip becomes an ordinary browse URL.
If filters exclude the selected trip, retain its selection and show **Selected trip is outside these filters**.
Do not draw its route as an extra result. Selected-only still intersects the other filters and can show zero results.
Offer **Clear filters** and **Clear selection**. Do not silently remove filters to manufacture a match.
Derive map source features, hit targets, tooltips, overlap choices, cards, and table rows from the same eligible IDs.
Route failures remain results with report links. Distinguish unavailable geometry from zero matching trips.
Filtering clears stale hover and overlap choices. A late route response cannot reintroduce an excluded trip.

## Acceptance cases

These cases define the design contracts. Observed test results follow in the next section.

| Case | Required result |
| --- | --- |
| No selection | Selected-only control is absent from layout and tab order. |
| Three drawer states | Buttons reach every state using keyboard, mouse, and touch without dragging. |
| Collapse from a focused card | Focus reaches the surviving arrow button before content becomes hidden. |
| Resize and filter | Camera values stay stable; explicit Fit results frames only current eligible routes. |
| Phone and 400% zoom | Forms reflow; focused controls remain visible; table scrolling stays inside its wrapper. |
| Apply invalid range | Inline error appears; prior applied results and URL remain intact. |
| Trip ends on From date | It matches. A trip starting on To date also matches. |
| Days 3–3; miles 600–600 | Exact values match. Missing values and mileage 600.1 do not match. |
| No active numeric filter | Trips with missing numeric facts remain visible and sort last. |
| Country-only Canada record | Canada-wide filtering matches; British Columbia filtering does not match. |
| US plus CA/British Columbia | Either geography matches; a same-named region in another country does not. |
| Cards to Table to Compact | IDs, order, selection, and counts agree; expanded Table preference survives. |
| Selected trip excluded | Warning appears; no hidden-selection route enters the map; selected-only can return zero. |
| Route error or late response | Trip count stays correct; excluded routes never return to map hit targets. |
| Clear filters | Filters clear together; selection, sort, camera, and layout remain stable. |
| Copied URL and browser Back | Committed browse state restores; independent visit cameras remain independent. |

## Implementation and verification

The [atlas guide](../trips/ADV-ATLAS.md) describes the implemented controls and URL parameters.
The implementation uses three desktop panel states and a phone bottom sheet.
Expanded results offer detailed cards and a native sortable table.
Shared filtering supplies the result list, map geometry, hit targets, tooltips, and route choices.
No runtime dependency was added.

Filter edits require **Apply filters**. Sorting and presentation changes apply immediately.
Camera values remain stable through filtering and layout changes. **Fit results** requests new bounds explicitly.
Panel sizing retains the visible card where possible.
Changing presentation returns to the top, which exposes the table caption and headings below the sticky tools.
Existing session records remain compatible.

Browser checks exposed two timing defects during implementation.
Selection reveal could run before the URL update inserted the selected-trip control.
It now waits for the committed selection before revealing the result.
Attribution loading could also change initial map padding.
Fixed control space now keeps framing independent of attribution and tile timing.

Checks used Node.js 24.22.1 and npm 12.2.1 on macOS.

| Check | Result |
| --- | --- |
| ESLint and TypeScript | Passed |
| Vitest with V8 coverage | 1,849 passed in 123 files |
| Python temperature checks | 17 passed |
| Complete production trip browser suite | 224 passed; 10 expected platform skips |
| Final Atlas browser run | 97 passed; 8 expected platform skips |
| Chromium and WebKit fixture suite | 79 passed; 5 expected platform skips |
| Full npm audit | Zero vulnerabilities |
| Production build | Passed; three published reports and no draft shells |
| Development build | Passed; 11 reports, including eight unpublished previews |
| Development publication checks | All draft shells disable indexing; RSS and sitemap exclude drafts |
| Visual inspection | Real-content desktop cards, comparison table, and phone sheets checked |
| Documentation links and whitespace | Passed |

The complete trip suite preceded the final table-heading correction.
The final Atlas run includes that correction in desktop Chromium, phone Chromium, and iPhone WebKit.
Builds used an isolated source copy to preserve local content previews.

Six added form tests increased statement coverage in `TripAtlasFilters.tsx` from 61.67% to 96.67%.
Branch coverage increased from 60% to 92%. Function coverage increased from 47.37% to 97.37%.
The comparison uses the same component source, compiler, and coverage provider.
The earlier measurement includes the existing page and data tests; the later measurement adds the six form tests.
These tests check draft cancellation, range validation, country and region replacement, unknown locations, and removable applied filters.

Final loaded-source coverage is 81.70% statements, 76.69% branches, 80.29% functions, and 83.82% lines.
Browser checks supplement that measurement. These percentages do not describe every repository file.
Physical-phone cold-cache verification remains in the existing [atlas follow-up list](../../TODO.md#adv-atlas).
