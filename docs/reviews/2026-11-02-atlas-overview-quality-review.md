# Atlas overview test review

Review date: November 2, 2026.
Baseline: `847934c878e4c8cbb1e70d5f295ab73b4035fbde`.

## Scope

The initial working tree changed the atlas overview test and its testing guide.
The review included the related map lifecycle, camera comparison, layout styles, browser helpers, and component tests.
The behavior requirements came from [ADV Atlas](../trips/ADV-ATLAS.md) and the [testing guide](../trips/TESTING.md).
Writing rules came from the [documentation index](../README.md).
Independent standards and behavior reviews checked the initial changes and the final implementation.

The [failed CI run](https://github.com/robert-bryson/rsmb.tv/actions/runs/41389393932) reached the final responsive width in both failing browsers.
Its traces showed successful preceding lookups and panel changes.
The combined test exhausted its 30-second budget during the final measurements.
The controls remained present in the failure snapshots.

No production defect was confirmed in the reviewed overview code.
The fixes below address test reliability and coverage.

## Standards

### Duplicated viewport cases could diverge

The pending split copied the responsive-width sequence into two tests.
A later breakpoint change could update the layout matrix without updating the reset sequence.
This was a maintainability finding, not a documented coding-rule violation.

The dedicated [overview suite](../../tests/trips/overview-controls.spec.ts) now owns one shared width sequence.
Each width has an independent test budget.
Common fixture setup runs before each case.
The suite retains the normal timeout and adds no retries.

### Reuse the existing target check

The short-screen suite already sampled nine points across each map control.
The overview matrix used a separate center-only check and partial containment assertions.
Maintaining both forms made their guarantees inconsistent.

Both suites now use [one helper](../../tests/trips/atlasTestHelpers.ts).
It measures each control, map viewport, and panel in one browser task.
It checks the minimum target size, all map edges, panel overlap, and nine pointer samples.
The measurements for each control therefore describe the same layout state.

## Spec

### The split separated panel changes from the reset regression

The original test compared painted route bounds after panel changes and responsive resizing.
The pending split retained each assertion, but separated these operations into different cases.
It no longer tested the combined sequence.

The reset regression now collapses the panel, traverses the widths, and restores the original layout.
It then compares route bounds after an overview reset and a keyboard pan reset.
Each width case also fits routes at its target width and checks that the painted geometry stays inside the map.

### Partial obstruction and expanded panels lacked overview coverage

The atlas requires complete 44-pixel control targets after panel expansion.
A usable center does not prove that the rest of a target remains usable.
The earlier matrix also omitted the expanded panel state.

Each width now checks compact, expanded, and collapsed panels.
The checks include zoom, fullscreen, share, and overview controls.
A negative case covers a 12-pixel corner while leaving the overview button's center usable.
The shared guard must reject that obstruction and pass after its removal.

### Camera comparison decisions lacked focused tests

Seventeen component cases extend the existing renderer fake.
They check center, zoom, rotation, pitch, rounding, complete rotations, initial animation, and incomplete camera results.
They also check pending and failed routes.
A resize must use current container dimensions and update overview visibility without requesting another fit.

## Documentation

The testing guide now groups control layout and camera checks under one heading.
It gives focused commands and states which checks run independently.
It explains the obstruction regression and combined reset sequence.
Instructions use short sentences, active voice, and consistent terms.

## Validation

| Check | Result |
| --- | --- |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Vitest | 2,021 passed across 138 files; 2,004 before review |
| Historical temperature pipeline | 17 passed |
| Complete trip browser suite | 433 passed; 17 skipped across Chromium, phone Chromium, and WebKit |
| Production fixture build and article budgets | Passed in the complete browser suite |
| Dependency audit | No known vulnerabilities reported |
| Whitespace checks | Passed |
| Documentation links | All local targets exist |

The complete browser run took 6.9 minutes with two workers.
The slowest overview case took 4.7 seconds. The test timeout remains 30 seconds.

Coverage uses the same 275 instrumented files and unchanged application source.
No files were excluded to improve the results.

| Coverage | Before | After |
| --- | ---: | ---: |
| All lines | 84.38% | 84.38% |
| All statements | 82.44% | 82.46% |
| All functions | 81.26% | 81.26% |
| All branches | 77.18% | 77.26% |
| Atlas map statements | 85.71% | 86.20% |
| Atlas map branches | 78.38% | 80.32% |

Browser validation used macOS and emulated phone viewports.
Linux CI and physical-phone behavior require their own runs.
