# Flight animation toggle responsiveness

Research date: November 5, 2026. Baseline: `b031e4b`, before the responsiveness changes.
This note examines the installed rendering libraries and a temporary production-browser probe.
Use the [implementation report](2026-11-05-responsiveness-improvements.md) for final behavior and measured results.

## Finding and smallest design change

The baseline animation toggle preserves arc geometry but also invalidates unrelated globe layers.
Stabilize the rendering accessors first.
Make `htmlElement` a module-level label factory. Use attribute-name accessors for coordinates.
A new `htmlElement` function causes the upstream renderer to recreate the complete airport label layer.
The points layer also replaces its materials when its accessors cause a digest.
A digest is the library's queued update of a rendering layer.
These costs are avoidable. Their contribution to the 333–440 ms baseline measurement requires a serial comparison.
Sources: [FlightsGlobe](../../src/features/flights/components/FlightsGlobe.tsx), [prop propagation](../../node_modules/react-kapsule/dist/react-kapsule.mjs), and [HTML and points implementations](../../node_modules/three-globe/dist/three-globe.mjs).

Keep the public `arcDashAnimateTime` accessor controlled by `animationEnabled && !prefersReducedMotion`.
The value `0` stops dash animation and preserves its accumulated position.
Preserve the memoized combined arc objects and static paths.
Sources: [animation accessor](../../node_modules/react-globe.gl/README.md) and [arcs implementation](../../node_modules/three-globe/dist/three-globe.mjs).

## Examined primary sources

Installed versions: `react-globe.gl` 2.38.0, `globe.gl` 2.46.2, `three-globe` 2.45.6, `react-kapsule` 2.6.0, and `kapsule` 1.16.3. Conclusions below apply to these installed versions. Source: their respective `node_modules/*/package.json` files.

- [FlightsGlobe.tsx](../../src/features/flights/components/FlightsGlobe.tsx): combined arc memoization, timing accessor, and JSX accessor identities.
- [FlightsMap.tsx](../../src/features/flights/components/FlightsMap.tsx), [useFlightsFilters.ts](../../src/features/flights/hooks/useFlightsFilters.ts), and [useGlobeCamera.ts](../../src/features/flights/hooks/useGlobeCamera.ts): URL state, rotation stopping, and camera ownership.
- [react-kapsule distribution](../../node_modules/react-kapsule/dist/react-kapsule.mjs), lines 30–34: forwards props whose references differ. The same identity comparison appears in the [official tagged source](https://github.com/vasturiano/react-kapsule/blob/v2.6.0/src/index.js#L41-L49).
- [kapsule distribution](../../node_modules/kapsule/dist/kapsule.mjs), lines 115–154: queues a one-millisecond debounced digest and records changed setter names.
- [globe.gl distribution](../../node_modules/globe.gl/dist/globe.gl.mjs), lines 76–88: forwards layer properties to ThreeGlobe.
- [three-globe distribution](../../node_modules/three-globe/dist/three-globe.mjs), lines 543–695, 834–1075, and 3188–3235: points, arcs, and HTML layer behavior.
- [reviewed performance samples](../performance/2026-11-02-flight-animation-reviewed.json) and [trusted-tap measurement](../../tests/e2e/flights-performance.spec.ts): original 332-flight dataset, Pixel 7, 4× CPU, 1.6 Mbps, six taps, and the two-animation-frame metric.

## What the upstream code actually does

`react-kapsule` compares each incoming prop with its last value using reference equality.
A new closure becomes a setter call even when it returns the same output.
Globe's linked setters forward that update into the corresponding layer.
Sources: [react-kapsule](../../node_modules/react-kapsule/dist/react-kapsule.mjs#L30), [globe.gl](../../node_modules/globe.gl/dist/globe.gl.mjs#L76), and [kapsule](../../node_modules/kapsule/dist/kapsule.mjs#L115).

Each arcs digest visits all arcs and updates dash parameters.
`__dashAnimateStep` is the internal speed field. `material.uniforms.dashTranslate.value` is the accumulated position.
This implementation has no `dashTranslateTime` property.
Geometry changes only when curve values, stroke values, or resolution change.
Vertex color and relative-distance attributes use a separate comparison key.
A timing-only setter does not rebuild tubes.
Source: [three-globe](../../node_modules/three-globe/dist/three-globe.mjs#L947), especially lines 1001–1003, 1008–1024, and 1032–1074.

A changed `htmlElement` accessor clears the HTML layer's object mapper.
The next digest creates new `CSS2DObject` instances and DOM labels.
Every unmerged points digest creates shared cylinder geometry and a material cache.
Visible points receive new material instances.
These operations are separate from the arc geometry cache.
Sources: [HTML layer](../../node_modules/three-globe/dist/three-globe.mjs#L3188) and [points layer](../../node_modules/three-globe/dist/three-globe.mjs#L584).

## Three falsifiable hypotheses

| Hypothesis | Discriminating experiment | Prediction and current evidence |
| --- | --- | --- |
| 1. Accessor identity churn causes label and material reconstruction, adding browser work around the toggle. | Keep the same data, scene, camera, and timing setter; stabilize HTML, point, and polygon accessors. Count removed/added labels and point material identities before and after each trusted tap. | Label replacements should fall from one complete layer per tap to zero, and unchanged point materials should retain identity. Latency should fall if this churn materially contributed. Source inspection proves the churn; its latency contribution is not yet isolated. |
| 2. Changing `arcDashAnimateTime` rebuilds every tube and dominates the delay. | Compare all arc geometry identities across six taps and time the upstream arc digest. | Tube identities would change and digests would occupy a large fraction of the measured delay. This hypothesis is falsified for settled, unchanged data by both the geometry guard and the structural browser probe below. |
| 3. Continuous rendering produces a frame-cost floor that dominates the two-frame metric. | Measure idle animation-frame intervals and renderer draw calls at the same CPU/device settings; compare click-to-DOM feedback, click-to-two-frames, and an ablation suppressing layer updates solely inside a throwaway fixture. Use CDP tracing to distinguish JS, layout, paint, and native/GPU waiting. | If scene throughput dominates, the two-frame result remains high even when layers do no update work, while immediate control feedback is much faster. The sampled profile is consistent with this hypothesis but does not establish it. |

Test hypothesis 3 before choosing a custom renderer.
The metric includes continuously scheduled scene frames.
Removing a few milliseconds of digest work cannot explain a several-hundred-millisecond improvement.
Source: [measurement implementation](../../tests/e2e/flights-performance.spec.ts).

## Structural browser probe

A temporary Playwright script intercepted the local production bundle in memory.
It observed changed setters, digests, label mutations, and arc geometry identifiers.
It did not edit application source or installed dependencies.
The fixture was `/tmp/rsmb-audit-build`, with local public flight data and textures.
It contained 334 flights, 521 combined arcs, and 47 labels.
The archived report used 332 flights, so this probe was not an exact replay.

All 521 arc geometry identifiers remained unchanged across six trusted taps.
The browser removed and added 282 labels: all 47 labels were recreated on every tap.
Arcs, points, HTML, and polygons each digested six times.
Changed props were `arcColor`, `arcStroke`, `arcDashAnimateTime`, `pointLat`, `pointLng`, `pointColor`, `pointAltitude`, `pointRadius`, `htmlLat`, `htmlLng`, `htmlElement`, `polygonCapColor`, and `polygonSideColor`.

Tooltip and event callbacks also changed: `onArcHover`, `onArcClick`, `arcLabel`, `onPointClick`, `pointLabel`, `polygonLabel`, and `onGlobeClick`.
These callbacks do not use the same geometry replacement path.
Preserve their dependencies if they are memoized.

The six-tap run spent 23.5 ms in arc digests, 12.2 ms in HTML digests, and 5.6 ms in points digests.
These durations cannot explain the complete measured interaction delay.
The identifiable JavaScript frames mainly contained Three.js matrix updates, object projection, draw setup, and CSS2D rendering.
Most sampled time was native or unclassified.
The profile cannot assign that time to a specific GPU or layout cause.

Other task work was active during these observations.
The probe stopped before completing comparisons that disabled individual rendering costs.
Later timing comparisons ran serially.
Treat the identifiers and node counts as structural evidence.
Do not use these durations as performance acceptance results.
Scratch artifacts: `/tmp/rsmb-flight-responsiveness-probe.json`, `/tmp/rsmb-flight-baseline.cpuprofile`, and `/tmp/rsmb-flight-baseline-profile-summary.json`.

## Implementation recommendation and behavior checks

1. Move label construction to a stable module-level function. Set `pointLat="lat"`, `pointLng="lng"`, `htmlLat="lat"`, `htmlLng="lng"`, and `polygonCapColor="color"`. Pass the constant side color directly. These public accessor forms are supported by [react-globe.gl's API](../../node_modules/react-globe.gl/README.md).
2. Memoize `arcColor` and `arcStroke` against `arcStyles` and the selected-flight-type styling callback. Memoize point color, altitude, and radius against the selection values they actually read. Use a stable empty arc array when paths are hidden, avoiding another array identity change on every render. Preserve data-object identities and current selection semantics. Source: [current renderer](../../src/features/flights/components/FlightsGlobe.tsx), [upstream reference comparison](../../node_modules/react-kapsule/dist/react-kapsule.mjs#L30).
3. Keep the existing timing setter and reduced-motion gate. Run the production six-tap test serially before/after with the same browser and dataset. Separately assert zero label replacements, unchanged arc geometry identities, frozen/resumed dash positions, preserved static routes, unchanged selection, functional drag/zoom/reset, browser back/forward state restoration, and zero toggle-triggered network requests. These checks follow the controls and state responsibilities in [FlightsMap](../../src/features/flights/components/FlightsMap.tsx), [useFlightsFilters](../../src/features/flights/hooks/useFlightsFilters.ts), and [useGlobeCamera](../../src/features/flights/hooks/useGlobeCamera.ts).

Do not call the top-level `pauseAnimation()` for the Flights toggle.
Its documented contract freezes rendering and cancels user interaction.
The public `scene()` getter does not make internal fields such as `__dashAnimateStep` supported APIs.
Changing those fields would create a dependency on internal library behavior.
Sources: [pause and scene contracts](../../node_modules/react-globe.gl/README.md#render-control) and [animation implementation](../../node_modules/three-globe/dist/three-globe.mjs#L947).

A custom layer remains an option if serial measurements identify the public timing setter as the bottleneck.
It can own animated-flight geometry and its time uniform while retaining built-in static arcs and controls.
`customThreeObjectUpdate` supports updating existing objects without recreation.
This design must reproduce curve construction, stroke and color selection, picking, and disposal.
The digest measurements do not justify that additional scope.
Sources: [custom layer API](../../node_modules/react-globe.gl/README.md#custom-layer) and [implementation](../../node_modules/three-globe/dist/three-globe.mjs#L3319).
