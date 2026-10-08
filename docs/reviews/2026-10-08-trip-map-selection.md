# Trip map selection review: 2026-10-08

## Scope

The initial working tree contained a map change and one regression test.
This review covers map selection, camera events, related tests, and current instructions.
It does not certify the complete application, infrastructure, or authored content.
No dependency, production service, or publication setting was changed.

## Findings and corrections

### P2: map loading could cancel the full-route action

The full-route button is available before the map load event.
The initial stop-focus effect previously ran after that event without checking the current selection.
It could move the camera back to the initial stop after the user selected the full route.
That camera movement could show the reset button again.

The load-time effect now reads the current selection through a React Effect Event.
The full-route action clears that selection. The load-time effect then has no stop to restore.
Tests check delayed loading with animated movement and reduced motion.

### P2: track replacement did not restore the selected stop

The first correction skipped initial focusing when the selected stop differed from the requested stop.
After track replacement, the new map could show track bounds while the stop list showed a selected stop.
The effect now restores the current selected stop, not only the requested stop.
Tests select another stop, replace the track, and delay the replacement load event.
They check the camera target and list selection in both motion modes.

### P3: browser timing did not guarantee the failure condition

The browser test supplied tile responses immediately.
A fast map load could hide the event-order defect.
The test now holds tile responses until after the first full-route action.
It waits for a tile request before that action.
Page closure releases pending responses if a test fails before the normal release.
The test retains attribution, zoom, and second-reset checks.

### P3: documentation described the wrong selection behavior

The authoring guide stated that replacement maps restored the requested stop.
The guide now distinguishes the requested stop from the current selected stop.
The repository guide includes WebKit setup and a repeated browser check.
The TODO list contains one WebKit setup task and one map-rendering extension task.

## Validation

| Check | Result |
| --- | --- |
| Map unit tests | 21 passed |
| Repeated delayed-load browser test | 6 desktop and phone Chromium checks passed |
| Full unit suite | 1,191 tests passed in 86 files |
| Temperature pipeline tests | 17 passed |
| Trip browser suite | 32 desktop and phone Chromium tests passed |
| Site browser smoke tests | 9 passed |
| ESLint and TypeScript | Passed |
| Dependency audit | Zero reported vulnerabilities |
| Synthetic production build | Passed with existing warnings |
| Focused map coverage | 92.34% statements, 91.05% branches, 87.50% functions, 94.85% lines |
| WebKit | Local execution blocked by missing host libraries |

The 17 unchanged map tests covered 109 of 123 branches on the current implementation.
The full map test suite covers 112 of 123 branches.
Branch coverage increased from 88.61% to 91.05% in this controlled comparison.
Statements, functions, and lines have the same coverage in both runs.
This comparison measures the new tests. It is not a repository-wide historical baseline.

The full suite measured 74.98% statements, 67.77% branches, 72.39% functions, and 77.52% lines.
These values describe measured source files, not every repository file.

## Remaining limits

The local WebKit browser cannot start without its host libraries.
Unit tests reproduce the selection defect, but they do not verify WebKit rendering.
CI installs those libraries and runs the WebKit project.
Run that project before you treat the original browser failure as verified.

The synthetic build still reports a large visualization chunk and a Tailwind source-map warning.
These existing warnings are outside the map selection change.
See [TODO.md](../../TODO.md) for incomplete work.

The revised documentation follows the repository ASD-STE100 writing rules.
No formal language certification was performed.
