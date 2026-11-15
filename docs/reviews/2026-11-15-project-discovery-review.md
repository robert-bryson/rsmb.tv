# Project discovery review — November 15, 2026

## Scope

This review starts at `1c81d70` with pending project-directory changes.
It covers the directory, shared search code, navigation state, action links, browser checks, and affected documentation.
The review does not assess every map implementation or certify external data sources.

The original suite passed 3,389 tests across 231 files.
The shared search hook reported 100% line and branch coverage.
Five new regression cases failed against that implementation.
A later controlled test also exposed a problem with typing immediately after clearing filters.
The passing suite did not test these behavior contracts.

## Medium: copied state suppressed another query

The hook identified an input write by its owner ID alone.
Another navigation could copy that state while selecting a different query.
Both Push and Replace then changed the URL but retained the old input and results.
Reusing an older saved entry caused the same inconsistency.

The [search hook](../../src/hooks/useSearchQuery.ts) now checks the revision, navigation type, owner, and exact parameters.
A matching record can be consumed once.
Back, Forward, and other navigation restore their own parameters.
The record is a local coordination mechanism. It is not a security boundary.

The hook also keeps one draft of the complete parameter string.
Previously, typing after a delayed clear could restore the removed category from the earlier URL.
Clearing and typing now use the same write path.
Earlier commits retain the newest draft, including a cleared category.
Unrelated object state remains intact. The temporary scroll-return flag is removed.

Controlled tests queue router writes and commit them one at a time.
They check copied state, replayed records, earlier commits, clearing, newer input, and history.
They also deliver pending commits out of order.
Each pending revision is consumed separately, so an earlier commit cannot truncate newer text.
React can replay an older router snapshot while urgent input renders.
Changing draft state during that render erased newly typed characters.
A browser trace reproduced that rollback while the address bar already contained the newer query.

Reconciliation now runs in a layout effect after navigation commits and before paint.
Functional updates retain input that arrived during a transition.
A narrow ESLint exception permits this external-state synchronization. The adjacent comment explains why render-time reconciliation is unsafe.
Clear actions retain their own internal record because they can also commit after newer input.
Tests check that record and the retained context explicitly.

The browser suite repeats twenty searches in each viewport and engine.
It checks input text, focus, URL values, and retained filters after every search.
The local instrumented workload also repeated eighty fresh-page attempts without character loss after the correction.

## Medium: rapid typing exceeded the browser history limit

The hook wrote the URL after every character.
The installed WebKit engine rejected more than 100 `replaceState` calls within ten seconds.
Input remained complete, but the URL stopped at an earlier query and the browser reported a `SecurityError`.

Query writes now wait 400ms after the last edit. Input, results, counts, and return links remain immediate.
Enter and blur commit the pending value without waiting.
Clearing all filters commits the old draft before creating the cleared entry.
Other navigation, native Back, and unmount cancel delayed writes.
Controlled-clock tests verify the delay, coalescing, explicit commits, and cancellation.
The repeated browser case also requires no page errors.

Post telemetry keeps its separate 300ms timer and reads draft filters.
The delayed URL commit cannot restart that timer or send a duplicate event.

## Low: category counts ignored the query

The category controls always displayed full-directory counts.
A technology search could show a nonzero category count and then return no projects from that category.

Counts now use the current search text and ignore only the selected category.
The visible result count still uses the complete directory as its total.
Tests check these two different count rules.

## Low: category counts were hidden from assistive technology

The count spans used `aria-hidden` without an equivalent accessible description.
Automated scans did not detect the missing information.
A direct accessible-description regression failed against that markup.

Each category link now keeps its visible name and explicitly references the count as its description.
The description uses the correct singular or plural noun.
Unit and browser assertions check the description independently of the visible count.
Project scans also include WCAG 2.1 level A and best-practice rules.
These include the visible-label checks that the earlier project-only tag list omitted.

## Low: the empty directory gave incorrect advice

An empty registry displayed the same message as an unsuccessful search.
It told the reader to try another keyword when no project existed.
Filtered totals also used a plural noun for a one-project directory.

The [directory](../../src/pages/Projects.tsx) now distinguishes those states and formats singular totals correctly.
Tests use empty and one-project registries and restore their fixtures after each case.

## Medium: production checks omitted project discovery

The new specification ran through the development browser runner.
The [production recovery runner](../../scripts/run-page-recovery-tests.js) did not include it.
CI therefore did not exercise these controls against optimized production JavaScript and CSS.

The standard recovery command now includes the specification in both configured engines.
The specification blocks external providers through the existing fixed-asset helper.
Expected directory totals come from the registry instead of repeated fixed numbers.
Post focus checks remain in the existing post specification, which avoids duplicate coverage.

The map-data check first requires no Flights request during search.
It then requires a real request after the reader selects **Open map**.
This positive check prevents an incorrect request pattern from passing silently.

## Maintainability and security checks

Project filters now use named options and accept an immutable input array.
The obsolete post-specific alias for the shared query helper was removed.
The query replacement tests now import the shared helper directly.

Search control tests check independent labels, descriptions, references, clear actions, and prevented form submission.
Analytics tests clear their spies between cases and require exactly one event for each tested action.
The directory does not place one link inside another link.
Internal actions retain router navigation. External actions retain their new-tab description and isolation attributes.

URL tests keep reserved characters and script-like text inside one encoded query value.
Registry tests parse action URLs and reject wrong schemes, origins, and credentials.
Project destinations are repository metadata. This review found no new user-controlled destination input.
No dependency versions changed. An external package audit was not part of this review.

## Validation

Final checks used Node.js 24.22.3 and npm 12.2.2.
The [measurement record](../performance/2026-11-15-project-discovery-review.json) contains commands, coverage counts, source hashes, and test limits.

| Check | Result |
| --- | --- |
| Complete Vitest suite | 3,414 passed across 235 files |
| Focused search and directory suite | 151 passed across 11 files |
| Temperature pipeline tests | 18 passed |
| Production browser checks | 40 passed in Chromium and WebKit; four unsupported forced-color cases skipped |
| Repeated typing within those browser checks | 80 searches; every input value, final URL, focus state, and retained filter checked |
| Normal production build | Passed with existing content; no external content refresh |
| Production fixture build | Passed through the standard recovery runner |
| ESLint | Passed with zero warnings |
| Application and script TypeScript checks | Passed |
| Repository line coverage | 88.85% |
| Repository branch coverage | 83.32% |
| Changed search and directory modules | 100% of lines, statements, branches, and functions across five modules |
| Local documentation targets | 153 Markdown files checked; no missing targets |

The local WebKit run used a temporary Linux launcher for its cached host libraries.
Repository browser configuration remains unchanged.
The documentation scan checks target existence. It does not check heading fragments or external sites.

### Coverage comparison

The comparison holds the final source, Node runtime, TypeScript compiler, V8 provider, and two-worker limit constant.
Both runs measure the same five production modules.
The subset omits four direct test files and the four directory regression cases.
It retains the adapted existing tests and the project URL assertions.
The complete run includes every focused case.

| Metric | Subset | Complete |
| --- | --- | --- |
| Lines | 93 of 94; 98.93% | 94 of 94; 100% |
| Branches | 92 of 94; 97.87% | 94 of 94; 100% |
| Functions | 37 of 38; 97.36% | 38 of 38; 100% |
| Statements | 113 of 114; 99.12% | 114 of 114; 100% |

The initial repository snapshot had 88.83% line coverage and 83.28% branch coverage.
That snapshot contains different source. Use the matched comparison above to assess the added tests on unchanged code.
No coverage thresholds were lowered, and no production modules were excluded from the complete suite.
Coverage measures loaded source. The behavior regressions remain necessary even when branch coverage reaches 100%.

## Documentation and remaining work

The initial link scan checked 150 Markdown files and found two missing local targets.
Both were links to renamed search modules in the previous dated review.
Those links now use the current paths. A note identifies the later behavior contract.
Historical measurements and findings remain unchanged.

The [project guide](../project-discovery.md) defines URLs, matching, counts, input ownership, actions, and validation.
The shared-module guide and post guide now identify the common field and hook.
README links the new guide and explains the production checks.

TODOs now identify the access or decision required for each work group.
Existing keyboard, screen-reader, and analytics tasks include project discovery without duplicate checkboxes.
New and revised prose follows the repository's simplified technical English rules.
Commands, identifiers, and historical evidence retain their exact forms.

Real phone keyboards, assistive technology, and hosted analytics still need the checks in [TODO.md](../../TODO.md).
Local browser emulation does not close those tasks.
