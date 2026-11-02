# Flight statistics quality review

Review date: 2026-11-02.

## Scope and assessment

The baseline is `b2ae8543d8c5a1fd4bce572a2ed2c981d6a471a2`.
The review covers commits `094b812` and `b6a1a16`, the pending flight-time interface changes, and their supporting modules.
The existing edits were retained and corrected.
The acceptance sources are the [repository guide](../../README.md), [flight guide](../../projects/flights/readme.md),
[basemap guide](../carto-basemaps.md), and [duration research](2026-11-02-flight-duration-research.md).
No external issue or separate product specification was supplied.

The initial suite passed all 2,161 tests. That result concealed errors in filtered statistics, navigation ordering, and accessible details.
The pending tests checked duration provenance through a `title` attribute after the interface removed its visible text.
That assertion verified markup without proving that a phone user could inspect the information.
The previous URL tests covered batched updates, but omitted older callbacks and intermediate navigation commits.

## Corrected defects

### P2: Concurrent URL updates could lose a layer toggle

[useFlightsFilters](../../src/features/flights/hooks/useFlightsFilters.ts) cleared pending writes whenever query parameters committed.
The browser can receive a newer navigation before React commits an earlier navigation.
The earlier commit then discarded the newer pending state.
A second layer shortcut could apply to obsolete state and enable the layer again.

Older setter callbacks also read obsolete query parameters after a commit.
They could discard a newer year or airline filter.
Separately, writing an unchanged rotation setting added a redundant history entry.

Setters now read the latest committed query through a shared reference.
They compose pending changes and retain newer writes through known intermediate commits.
Browser history navigation and other external queries clear pending writes.
An unchanged query does not create a navigation.

Four router integration cases reproduce obsolete callbacks and redundant history entries.
Five controlled router cases cover intermediate commits, repeated queries, external navigation, and browser history precedence.
The original browser sequence also checks repeated layer shortcuts.

### P2: Selected airport lists used lifetime counts

Country and region details built their airport lists from map points.
Those points contain lifetime visit counts and can include airports outside the active airline filter.
Flight counts and duration totals used matching legs, so one panel combined incompatible statistics.

Both lists now use one shared endpoint aggregator over their matching flights.
The aggregator is local to [useSelectionInfo](../../src/features/flights/hooks/useSelectionInfo.ts).
Each matching departure or arrival contributes one airport visit.
A flight inside one area contributes two airport visits and one duration to that area's totals.
Eight integration cases cover airline, year, flight type, internal flights, empty results, and later recovery.

### P2: Duration provenance required hover

The pending compact interface put timing coverage in a nonfocusable span's native `title` attribute.
Touch users had no ordinary control or detail text that exposed the coverage.
The generic span also relied on `aria-label` for its spoken time.

Expanded **Flight Time** sections now show actual, scheduled, estimated, and unavailable counts.
They also show the estimate method and partial-data denominator.
Compact values retain hover details and include full spoken time and coverage as visually hidden text.
Their abbreviated visual values are hidden from assistive technology to prevent duplicate readings.

### P2: Statistics disclosures lacked accessible state

The shared section button had no `aria-expanded` or `aria-controls` attribute.
Its decoration formed part of its accessible name.
It also lacked an explicit button type, which could submit an enclosing form.

Each button now exposes its state and a unique, stable content target.
Decoration is hidden from assistive technology. Keyboard focus has a visible outline.
Collapsed sections retain their target container and unmount their contents.
Tests cover controlled state, independent targets, form behavior, and keyboard activation.

### P2: Airline aliases accepted inherited object properties

`normalizeAirline` read the correction table with an unrestricted property lookup.
The names `constructor` and `__proto__` therefore resolved to inherited values rather than airline text.
The subsequent string operations could fail before the sync produced a validation result.

The lookup now accepts only declared properties with `Object.hasOwn`.
The correction is in [sync-flights.js](../../scripts/sync-flights.js).
Unknown airline names remain strings through validation and CSV serialization.
Boundary tests also cover invalid dates, airport syntax, duplicate routes, blank airlines, and suspicious durations.

### P3: A feature changelog included a repair

The flight changelog combined authenticated globe tiles with a state-overlay repair.
The repository's changelog procedure excludes standalone repairs.
The note now describes only the added capability. Historical review records retain the repair evidence.

### P3: Renderer readiness could update an uncommitted camera

Browser validation exposed a React warning about an update before mount.
A captured stack identified `useGlobeCamera`'s `onGlobeReady` callback.
The renderer can call this callback before its parent commits, including from work that React later discards.

The hook now records an early readiness request without updating state.
Its layout effect applies the request after mount.
Callbacks from discarded work cannot update camera state.
A suspended-render regression reproduces the original warning.
A second test retains support for a child reporting readiness before its parent's layout effect.
The browser suite also checks for this warning during globe initialization.

## Standards

The independent Standards review found one documented violation: the mixed feature and repair changelog entry.
The applicable rule is in `README.md`, under **Project Changelogs**.
The highest severity on this axis was P3. The violation is corrected.
The review did not require additional abstractions solely to satisfy a code-smell heuristic.

## Spec

The independent Spec review found two behavior mismatches.
The duration research requires coverage in ordinary touch details.
The flight guide requires consistent filtering across totals and selected details.
The pending duration interface broke the first requirement.
The older country and region airport lists broke the second requirement.
Both findings had severity P2 and are corrected.

## Documentation changes

The flight guide now explains timing disclosures, filtered airport visits, and URL update ordering.
It also contains the Sheet schema and validation rules.
The sync script links to that guide instead of duplicating a long, outdated procedure.
The repository test guide and documentation index link to the current checks and this review.
New prose uses short sentences, active voice, and consistent terms.

## Validation

| Check | Result |
| --- | --- |
| Vitest with V8 coverage | 2,202 tests passed across 154 files |
| New regression cases | 41 additional Vitest cases |
| Temperature pipeline | 17 Python tests passed |
| Browser regressions | 50 cases passed across Chromium and WebKit |
| Repeated keyboard sequence | Five isolated failures before correction; five passes after correction |
| TypeScript | Passed |
| ESLint | Passed with zero warnings |
| Production bundle | Passed with the fixture CARTO key |
| Dependency audit | Zero reported vulnerabilities |
| Documentation links and whitespace | Passed |

The browser set covers flight durations, camera controls, basemaps, and Tornado Tracks.
It includes keyboard activation, narrow layouts, texture recovery, clipboard failure, and the camera readiness warning.
The default browser port was occupied. Validation used an isolated server on port 4197.
The existing server was left running.

The bundle check uses committed content and `browser-test-key`.
It does not establish authorization for a live CARTO account or its allowed websites.

### Coverage comparison

Both measurements use the same final application source, compiler, and V8 coverage provider.
The first run excludes the six new regression files. The second includes the complete suite.
The measurements cover loaded source files rather than every file in the repository.

| Suite | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| Existing 2,161 tests | 82.31% | 77.72% | 80.68% | 84.07% |
| Complete 2,202 tests | 82.43% | 77.91% | 80.75% | 84.16% |

Line coverage increases by 0.09 percentage points. Branch coverage increases by 0.19 percentage points.
The small aggregate gain includes tests that expose failures within lines already covered by earlier cases.
The failing-before-fix cases establish behavior that a coverage percentage cannot establish alone.

Independent review totals: Standards — one finding, highest P3; Spec — two findings, highest P2.
