# Trip map interaction review: 2026-10-27

## Scope and assessment

The baseline is commit `e4bdd83e2872cb46fc12f9e381a68868d0e88e9d`.
The reviewed changes were uncommitted when this review started.
They change route hover, day selection, inline route context, previews, and trip labels.
They also add Ocean Shores day assignments and remove duplicate story navigation.

The starting map suite passed 75 cases with 93.37% branch coverage.
It still missed interactions between pointer input, keyboard focus, loading, suspension, and recovery.
The main weakness was shared state without a clear owner for each input source.
Several tests checked individual actions but omitted transitions between those actions.
High coverage did not prove correct behavior.

Independent standards and specification reviews used the repository guide and current trip authoring instructions.
The current authoring instructions take precedence over the earlier day-map research recommendations.

## Standards

### P2: Pointer exit removed active keyboard feedback

Focus a day button, move the pointer over it, then move the pointer away.
The button retained keyboard focus, but its tooltip, route emphasis, and description reference disappeared.
Moving the pointer across a route caused the same failure.

`TripMapDayControls` treated pointer and keyboard events as writes to one highlight ID.
Every pointer exit cleared that ID, regardless of keyboard focus.
This violated the authoring guide's focus behavior.

The shared `useTripDayHighlight` hook now keeps pointer and keyboard state separate.
Pointer feedback takes priority while active.
Pointer exit restores feedback for the focused button.
Map and SVG regressions check both input sources together.

### P2: Escape could not dismiss an unselected day popup

Focus or hover a day without selecting it, then press Escape.
The popup remained open because dismissal listeners required a selected day.

Popup dismissal now works before selection.
Escape outside the map closes transient feedback without changing that map's selected day or camera.
Escape within the map can also reset its day selection.
Both renderers have regression coverage for these boundaries.

### Maintainability: Highlight state had several owners

The controls, SVG renderer, interactive map, and popup hook each cleared the same conceptual state.
This was a duplication and ownership concern, rather than a separate hard standard violation.

The shared highlight hook now owns input precedence and dismissal.
The popup hook owns popup position and resource cleanup.
The dismissal hook identifies whether an event can reset selection.
Repeated pointer movement over the same day does not force another React state update.

Standards result: two behavior findings and one maintainability finding.
Mixed pointer and keyboard input was the clearest standards defect.

## Spec

### P2: Dismissal during suspension discarded the saved camera

The guide requires a reset to "restore the view from before day selection."
Pan the overview, select a day, suspend the map, then dismiss the selection.
The old reset cleared the saved camera while no map existed to receive it.
Recovery therefore showed the default overview.
Map failure produced the same loss.

The saved camera now remains available until the next map instance can restore it.
Restoration includes center, zoom, bearing, pitch, and padding.
The initial overview zoom adjustment does not run after this restoration.
Changing routes clears the saved camera, including an inactive A-to-B-to-A route transition.

### P2: Focus feedback ended when pointer feedback ended

The guide requires keyboard focus to "emphasize its tracks" and show the same popup as hover.
The standards finding above also violated this behavior requirement.
The correction applies to both the interactive map and SVG preview.

Spec result: two behavior gaps, with one overlap in the standards findings.
Losing the saved camera was the worst specification gap.
No clear unsupported scope expansion was found.

## Additional findings

### P2: Route replacement retained stale feedback

Changing the route cleared selected days but retained hover and keyboard feedback from the previous route.
Shared day IDs could make a new route display the previous route's emphasis and popup.
The highlight hook now resets its state when the route URL changes.
Both renderers have route-replacement regressions.

### P2: The preview handoff could lose Escape

The interactive map can replace a focused preview before a keyboard event reaches the document listener.
Checking whether the new figure contained the old event target rejected a valid map event.
A desktop browser run exposed this timing failure.

Dismissal now checks the event's composed path against the stable map viewport.
This path records the event's original propagation boundary.
A regression replaces the preview during key dispatch and verifies selection reset.
The same boundary also prevents a preview button click from immediately dismissing its new map.

### P3: Verification tools read generated browser artifacts

ESLint scanned temporary JavaScript inside Playwright traces.
A concurrent trace cleanup caused ESLint to fail with `ENOENT`.
Vite also treated generated coverage pages and trace pages as application changes.
Those writes triggered unrelated browser reloads.

ESLint now excludes browser output directories.
The Vite watcher excludes coverage and browser output directories.
These exclusions apply to generated reports, not application source or test source.

### P3: Paint transitions obscured the browser extent check

A WebKit run reported equal route centers but different route edges after reset.
Each edge differed by one CSS pixel, matching the change from four-pixel to six-pixel route strokes.
MapLibre retained the previous data-driven paint during its default transition.
The existing reduced-motion setting disabled camera animation alone.

Reduced motion now also disables route color, opacity, and width transitions.
Unit assertions check both motion settings.
The browser helper now returns the snapshot that passed its stability check.
Previously, it returned a third snapshot that had not passed that check.
The exact extent assertions remain in place.

## Tests and coverage

Fourteen added unit cases cover mixed input, dismissal boundaries, route replacement, camera recovery, and the preview handoff.
Eight initial regressions failed against the starting implementation before their fixes.
Two further route-replacement regressions also failed before the state reset was added.
The browser hover case now checks mixed pointer and keyboard input, Escape, and retained keyboard focus.

The controlled coverage comparison uses the same final source, compiler, and V8 coverage provider.
It uses the three map test files in the repository guide.
The control excludes the fourteen added cases.
Both runs measure eight modules: the story map block, day controls, two renderers, view resolver, and three interaction hooks.

| Measure | Control: 75 cases | With additions: 89 cases |
| --- | --- | --- |
| Statements | 95.59% | 96.20% |
| Branches | 92.48% | 94.11% |
| Functions | 94.91% | 94.91% |
| Lines | 98.87% | 99.25% |
| Interactive map branches | 91.49% | 93.87% |
| Preview branches | 96.59% | 97.95% |

Full-suite coverage is 78.37% statements, 72.41% branches, 76.46% functions, and 80.59% lines.
This measures loaded files, rather than every repository file.

## Verification

| Check | Result |
| --- | --- |
| Complete Vitest suite with V8 coverage | 1,411 passed across 99 files |
| Focused map suite | 89 passed |
| Python temperature pipeline | 17 passed |
| ESLint | Passed with zero warnings |
| TypeScript project checks | Passed |
| Dependency audit | Zero reported vulnerabilities |
| Complete production trip browser suite | 66 passed |
| Final day-map browser suite after the paint correction | 18 passed |
| Browser smoke suite | 16 passed |
| Production fixture compilation and article JavaScript budgets | Passed |

The complete browser run passed before the final reduced-motion paint correction.
All eighteen day-map cases passed after that correction in desktop Chromium, phone Chromium, and phone WebKit.
An intermediate run exposed the Escape handoff defect and the paint-transition measurement problem.
The final browser cases retain exact extent comparisons.

## Documentation and content

The authoring guide now separates day assignments, overview controls, inline maps, recovery, galleries, and focused maps.
The guide defines pointer precedence, Escape scope, saved-view restoration, and route-state reset.
The repository guide includes the new validation cases.
These edits use short sentences, active voice, and consistent terms.
They aim for the requested simplified technical style without claiming formal ASD-STE100 certification.

Trip labels use place names.
The synthetic fixtures and their assertions use matching labels.
The Ocean Shores track IDs match its local route geometry.
The existing Boise gallery edit remains part of the reviewed changes.

## Limits

No direct security defect was found in this diff.
Popup text uses MapLibre's text API, rather than HTML interpretation.
The dependency audit reported no known vulnerabilities at review time.
These checks do not constitute a security audit of every feature.

The browser tests use synthetic articles and fixed tiles.
They do not verify live tile services, private source records, real-device GPU use, or deployment.
The generated Ocean Shores article was unavailable locally, so its new heading targets were not independently verified.
Dedicated stop-marker selection and three-style browser checks remain in `TODO.md`.
