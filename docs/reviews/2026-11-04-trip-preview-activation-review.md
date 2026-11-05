# Trip preview activation review — 2026-11-04

Reviewed the uncommitted changes against `76ad3256368debb5af841247cd8639415432abe1` on `main`.
The initial diff changed four files: the trip map block, its browser test, the trip testing guide, and the About page.
The review included the related map lifecycle, selection, dismissal, and recovery code.
The requested behavior came from the testing guide. No separate issue or design spec was supplied.

## Standards

No documented-standard violation or security defect was found in the initial four-file diff.
The About page adds a static `mailto:hello@rsmb.tv` link. It needs no form handler or new dependency.
The map remains a dynamic import. Reading routes must retain their existing JavaScript budgets.

The initial regression had a material test gap. Severity: P3. Corrected.
It held the map module until after mouse-up.
This proved that one delayed response preserved a click.
It did not prove correct behavior when another map had loaded the module or when loading finished during the press.
Those orderings change whether React suspends, so they require separate checks.

The revised browser cases cover pointer input and the Space key.
They hold a real visibility entry until the control is pressed.
They check loading after the click, loading during the press, and a module loaded through another map.
They also check an explicit **Explore interactive map** action before the day press.
Another case delivers automatic activation while **Explore interactive map** is pressed.
The cases retain the original button's identity through release, then check selection and keyboard focus.
Two animation frames permit a ready transition to commit before the control is released.
These frames expose the race; they do not replace assertions about button identity and selection.

No shared abstraction was added for the About link or unrelated page markup.
The review did not find enough duplication to justify one.

## Spec

One incomplete requirement was found. Severity: P2. Fixed.

The testing guide required selection to survive loading and required the same preview button to receive the complete click.
The initial implementation used `startTransition` to retain the preview during a suspended import.
That protection ends when the module is ready.
React could then replace a pressed button before pointer release or Space-key release.
The native click could miss its handler, leaving the requested day unselected.

The block now records the active pointer ID or activation key.
It retains the primary preview until the click completes or the input is cancelled.
The module can continue loading during this hold.
The click handler releases the preview during bubbling, after the day handler records selection.
Release uses a transition, so pending code does not replace the focused preview with another loading view.

Explicit exploration also uses a transition.
Browsers without `IntersectionObserver` first mount the preview, then activate from the mount effect.
Both paths retain the same preview while code loads.
This prevents a press from switching between the Suspense fallback and primary preview.
Initial, overlapping, and repeated exploration retain the boundary key.
Only an explicit retry from the error view replaces the failed boundary.

Input cleanup covers pointer cancellation, release outside the map, keyboard focus leaving the map, and window blur.
An unrelated pointer release cannot end the primary press.
Pointer input stays protected when Safari leaves keyboard focus on the document body.
The parent owns preview selection dismissal through the shared figure ref.
Escape and outside clicks can clear selection before the module loads.

New unit cases also verify that a late module cannot reactivate a map suspended outside the viewport.
Existing tests continue to check route changes, renderer recovery, focus retention, and explicit retries.

## Coverage

The controlled comparison uses the final `TripMdxBlocks.tsx` source for both measurements.
It uses the same compiler, Vitest version, and V8 provider.
The baseline runs the 21 original lifecycle, selection, and recovery tests.
The expanded run includes 47 tests across those files and the new activation suite.
Temporary copies of the original tests were removed after measurement.

| Coverage for `TripMdxBlocks.tsx` | Original tests | Expanded tests |
| --- | ---: | ---: |
| Statements | 70.14% (94/134) | 98.50% (132/134) |
| Branches | 58.82% (50/85) | 95.29% (81/85) |
| Functions | 73.91% (34/46) | 97.82% (45/46) |
| Lines | 71.96% (77/107) | 100% (107/107) |

These figures measure the map block module. They do not describe repository-wide coverage.
The new tests observe selection, DOM identity, activation, cancellation, and resource state.
They do not inspect React's private transition state.

## Documentation

The testing guide now separates content, layout, map input, galleries, articles, and animations.
It includes the focused activation command and the new unit suite.
Instructions use direct verbs and short sentences where practical.
This is a plain-language cleanup, not a claim of formal ASD-STE100 compliance.

## Validation

| Check | Result |
| --- | --- |
| Full Vitest suite with V8 coverage | 166 files and 2,507 tests passed |
| Focused map block coverage | 47 tests passed; comparison above |
| Python analysis suite | 17 tests passed |
| Production fixture build and browser checks | 94 passed across Chromium, phone Chromium, and iPhone WebKit; two desktop-only touch cases skipped |
| ESLint | Passed with zero warnings |
| TypeScript | Passed |
| Diff whitespace | Passed |

The browser command includes day maps, recovery, dismissal, suspension, panorama layout, map attribution, and reading-route JavaScript budgets.
The production fixture build requires no Google content access or production map credentials.

## Limits

Browser checks use production builds with synthetic content and intercepted map assets.
They validate Chromium and WebKit on this macOS host.
They do not establish Linux WebKit rendering, live provider authorization, or deployed behavior.
No production deployment is part of this review.

Initial findings: Standards, one P3 test gap; Spec, one P2 activation defect. Both are corrected.
