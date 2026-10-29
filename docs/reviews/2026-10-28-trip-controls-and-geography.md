# Trip controls and geography review: 2026-10-28

## Scope and assessment

The baseline is commit `56d1434f47f5efc5ff7313f0ea7b46c58a45fe6d`.
The review started with 27 uncommitted files. The commit retains those changes and adds the corrections described here.

The scope includes trip geography, filter tags, map controls, heading links, breakout layout, browser configuration, and their dependencies.
Separate standards and specification reviews used the repository guide, trip authoring guide, and blog publication guide.
No separate issue specification was available.

The initial 1,484 unit tests passed. Several important state transitions were still wrong.
The main weakness was deriving map mode from mutable selection, then treating control state as loaded-map state.
High line coverage did not establish correct behavior during loading, reset, suspension, or configuration changes.

## Standards

### P2: The Stops button reported stale state during loading

`TripRouteMap.tsx` created the button before the map's load event.
Its visibility effect returned before updating the button when `loadedMap !== map`.
An early click hid the React stop list but left `aria-pressed` and the tooltip unchanged.

The correction updates the DOM control immediately. Only map-layer writes wait for the current map to load.
A regression toggles the button three times before loading. It checks immediate feedback and the final marker visibility.
That regression failed before correction.

### P2: Grouped geography hid accepted legacy facts

`TripFacts.tsx` showed country groups whenever the country list was nonempty.
It then omitted every flat region, while `posts.ts` still indexed those regions as filter tags.
A valid manifest could therefore match an Oregon filter while its facts omitted Oregon.

The details panel now shows country groups first. It then shows legacy regions absent from those groups.
A region already present in a country group appears once.
This preserves existing manifests and keeps visible facts consistent with filter membership.
The mixed-format regression failed before correction. Another case checks an empty country list.

### P3: Geography identity fields lacked validation

`TripFacts.tsx` uses country codes and region names as React keys.
The schema accepted duplicate codes and repeated names within a region list.
The legacy region field also accepted whitespace-only names and retained surrounding spaces.
These inputs produced duplicate keys or unusable fact labels.

One shared region schema now trims names and rejects empty or duplicate values.
The country list rejects duplicate codes.
The same region name can occur under different countries because those lists have separate identities.
Eight added schema cases cover rejection, normalization, and valid boundary cases.
Five of those cases failed before correction.

### P3: Current procedures named a removed control

The authoring guide still specified a `Show stops` checkbox.
The implementation exposed a `Stops` toggle button.
This violated the documentation rules for consistent terms and current procedures.

The guide now describes the button, its pressed state, immediate feedback, and availability in previews.

Standards result: four findings. The delayed button feedback was the clearest interaction defect.
No additional abstraction was needed to address the identified duplication.

## Spec

### P2: Loading broke the shared stop visibility contract

The guide required the control to change markers and the stop list together.
The delayed-load defect above also violated this behavior requirement.
The button and caption now report the latest preference while layer updates wait for loading.

### P2: Reset stop maps became overview previews

The guide requires previews and recovery to retain the map's controls and visibility setting.
`TripRouteMap` cleared the selected stop to an empty string during a full-route reset.
It passed that selection to `TripRoutePreview`, which inferred overview mode from falsy focus identifiers.

After suspension or failure, a stop-focused map therefore lost its markers, list, and Stops button.
Its parent still represented a focused map.
This adjacent defect existed before the new button, but the button exposed another lost control.

The preview now respects the parent's explicit mode. It infers mode only when no override is supplied.
Two regressions cover reset followed by suspension or failure.
They check preview controls, visibility changes, recovery, and the cleared selection.
Both failed before correction.

### P3: The authoring procedure described the wrong control

The obsolete checkbox procedure also contradicted the implemented interface.
The correction appears in the standards findings above.

### P3: The blog guide omitted country tags

The guide described only motorcycle and region tags.
It now includes country-code tags and gives exact examples.

Spec result: four findings. Losing the focused preview after reset was the largest behavior gap.
The reviewed changes showed no clear scope expansion.

## Additional lifecycle findings

### P2: Focus-mode changes retained the wrong controls

The map constructor added Stops only when the initial configuration was focused.
Changing `stopId` from absent to present changed map mode without recreating the controls.
Changing back could retain the focused control on an overview.

Map mode is now a construction dependency.
Crossing between overview and focused mode rebuilds the map and its controls.
Changing between requested stops within the same mode retains the healthy instance.
The regression checks both mode transitions and removal of the previous instances.
It failed before correction.

### P2: An overview day overrode a new stop or track focus

Day selection tracked the route URL and requested day, but omitted the requested stop and track.
Selecting Coastbound in the overview could therefore leave a later Return ride map focused on Coastbound.
The stale day also removed stops outside its membership.

Day selection now belongs to the complete focus configuration.
Changing that configuration also clears the previous saved overview camera.
Two regressions cover transitions to stop focus and track focus, then back to the overview.
Both reported `Map of Coastbound` before correction, despite the new focus request.

## Tests and coverage

Sixteen new unit cases cover the identified boundaries.
The controlled comparison uses the same final source, Vitest 5.0.5, V8 provider, and two-worker setting.
The comparison run excludes only the sixteen added cases through the test-name filter.
It passes 1,484 cases. The complete run passes 1,500 cases across 103 files.

| Measurement | Existing tests on final source | All tests on final source |
| --- | --- | --- |
| Statements | 78.84% | 78.87% |
| Branches | 73.15% | 73.19% |
| Functions | 77.24% | 77.35% |
| Lines | 80.92% | 80.93% |
| TripRouteMap lines | 99.57% | 100.00% |
| TripRouteMap functions | 96.87% | 100.00% |
| TripRoutePreview branches | 98.03% | 98.69% |
| TripFacts branches | 93.10% | 96.55% |

Coverage measures loaded files. It does not measure every repository file.
The modest aggregate increase understates the value of tests that expose incorrect transitions through already-covered lines.

| Check | Result |
| --- | --- |
| Complete Vitest suite with V8 coverage | 1,500 passed across 103 files |
| Historical temperature Python suite | 17 passed |
| ESLint | Passed with zero warnings |
| TypeScript project references | Passed |
| Authored trip manifests | All three passed the updated schema |
| Site browser smoke tests | 17 passed in Chromium |
| Production trip browser checks | 87 passed across desktop Chromium, phone Chromium, and iPhone WebKit |
| Final day-map browser checks | 27 passed across the same projects after the selection-scope correction |
| Firefox trip checks | All 29 failed before test execution because the browser could not open its temporary profile |
| Production fixture build and JavaScript budgets | Passed |
| Dependency advisory audit | Incomplete; automatic approval review rejected the external metadata request |

The host used Node.js 26.12.0 and npm 11.20.0 with the existing dependency installation.
The repository requires npm 12.2.1. A clean installation under that npm version was not tested.

The Firefox log reports `Could not find profile folder`.
A separate launch check with a profile under `/private/tmp` failed the same way.
Firefox behavior, including its visible-window overflow regression, remains unverified on this host.

The first sandboxed smoke-test attempt could not download public state boundaries.
The first trip attempt could not bind its local server.
Authorized retries resolved those two setup limits. They do not affect the passing results above.

## Documentation and retained work

The repository guide now links to a dedicated [trip testing guide](../trips/TESTING.md).
That guide contains browser setup, focused commands, test contracts, and unchanged JavaScript budgets.
The authoring guide defines mixed geography behavior and updates map reset and visibility checks.
The blog guide explains country tags and headings that already contain authored links.
Instructions use short sentences, active voice, and consistent terms.

The commit also retains the original country migration, summary propagation, filter tags, heading permalinks, and Firefox overflow layout correction.
Existing publication, rendering, navigation, and budget tests cover those changes.

The remaining map decomposition and browser extension tasks stay in [TODO.md](../../TODO.md).
This review does not replace the existing content publication checks.

## Security limit

Source inspection found no direct security defect in this diff.
This does not establish that the complete dependency tree has no known vulnerabilities.
Automatic approval review rejected `npm audit` because it sends dependency metadata to npm's external advisory service.
The advisory check requires approval for that disclosure before it can be completed.

Standards: four findings. Spec: four findings. Two additional lifecycle defects were fixed.
Several findings describe the same defect from different review axes.
