# Project quality review — November 14, 2026

## Scope

The baseline is commit `620c25c`.
The working tree contained six changed files at the start of this review.
Those edits raised the collapsed gallery limit to 12 and changed PCH scene groups.
This review preserves those edits.

The review covers their components, viewer links, manifests, authoring references, and tests.
It also checks article navigation, dashboard events, watcher cleanup, build checks, and dependency advisories.
It does not establish source accuracy for unpublished travel content.

The initial suite had 3,262 passing tests and two content-contract failures.
Both failures came from stale PCH references.
Earlier sandbox subprocess failures were environmental. They disappeared when the same checks ran with subprocess access.

The change was not ready to commit in its initial state.
Its new gallery boundary checks passed while existing authoring contracts failed.
The broader suite also missed defects in observer state and dashboard resource ownership.

## Findings and corrections

### Medium: gallery references no longer matched the manifest

The manifest added `day-four-1`, `day-four-2`, `day-four-3`, and `bridgeport-night`.
The authoring table still listed 28 galleries and omitted those four names.
Several existing scene counts were also wrong.
A content test still required the morning coast photo inside `inland-california`.
The source story now places that photo inline.

The [PCH reference](../trips/pch-2024-galleries.md) now lists all 32 galleries and their current counts.
It separates inline placements from complete day galleries.
It also identifies the three photos omitted from the current scene selection.
Those photos remain available in the manifest, day galleries, and hero viewer.

Tests verify that each reference row appears once and uses the current photo count.
New membership checks cover the October 6 splits and October 7 park photo.
They detect repeated or lost photos across the selected scene groups.

### Medium: partial observer updates lost visible headings

The contents callback treated each notification as the complete set of visible headings.
Intersection notifications contain only changed targets.
A newly visible lower heading could replace an earlier heading that remained visible.
An exit-only notification could leave an invisible heading marked as current.

The [contents component](../../src/blog/PostTableOfContents.tsx) now retains the visible targets for each observer.
It updates that set from each notification.
It reads current positions before selecting the first visible heading.
This avoids ordering targets by an old rectangle from an earlier notification.
When no heading is visible, the last current location remains selected.

Two unit regressions failed before this correction.
Browser checks exercise entry, exit, upward scrolling, and viewport changes.
They cover 1280 × 1000 and 1920 × 720 in Chromium and WebKit.

### Medium: event expiry required another event

The dashboard pruned expired events only when adding a new event.
An old message could remain visible indefinitely during a quiet period.
A newly mounted reader could also receive expired entries.

The [event store](../../scripts/dashboard/useEventLog.tsx) now checks expiry at mount and at each two-second poll.
It changes the store revision only when pruning removes an entry.
Quiet polls do not cause extra renders.
Each reader releases its own timer at unmount.

Duplicate updates also mutated an event object from an already returned snapshot.
They now replace that object.
Earlier snapshots retain their original count and time.
Tests cover expiry boundaries, quiet startup, capacity, duplicates, two readers, clearing, and unmount.

### Medium: logging could throw or leave writes incomplete

Console capture called `JSON.stringify` on arbitrary arguments.
Circular objects and `bigint` values could throw during logging.
Ordinary `Error` objects lost their useful message under JSON serialization.
The stderr replacement also ignored completion callbacks.
Code waiting for such a callback could remain pending.

Capture now uses Node.js formatting for console arguments.
Console and stderr messages share filtering and length limits.
Terminal control sequences are removed before display.
Stderr buffers retain their supplied encoding.
Completion callbacks run asynchronously, including for omitted messages.

Interception returns a cleanup function.
Calling cleanup again has no effect after the first call.
Tests verify restoration and a second capture session.
They also cover circular objects, errors, format arguments, numeric values, encoded buffers, and filtered callbacks.

### Medium: quitting left the watcher timer active

The watcher created a 60-second performance-buffer timer at module startup.
It did not retain or clear that timer.
Ink could finish while the timer continued to keep the process alive.

The [watcher](../../scripts/aws-watch.tsx) now owns that timer within the terminal session.
It waits for Ink to finish.
A `finally` block stops the timer and restores output capture.
Three tests cover normal exit, a render failure, and an asynchronous exit failure.
The tests use a simulated terminal and do not contact providers.

### Low: current documentation contradicted viewer behavior

The repository guide said inline photos used separate viewers.
Linked inline photos already joined the story viewer in document order.
That description is now correct.
The guide also states the 12-photo expansion boundary.

The new [dashboard guide](../dashboard.md) owns its controls, event rules, output contract, and test commands.
The repository guide links to that procedure.
The completed event-log testing task was removed from [TODO.md](../../TODO.md#dashboard-checks).
Provider and cost-cache tests remain open.

The writing rules now state the requested 80% simplified-language target.
Revised prose uses short sentences, active voice, and consistent terms.
Technical identifiers, source facts, and commands retain their exact forms.
Dated review measurements remain historical evidence.

## Validation

The [measurement record](../performance/2026-11-14-project-quality-review.json) records commands, scope, results, and coverage.

| Check | Result |
| --- | --- |
| Unit tests | 3,282 passed across 227 files; 18 regressions added |
| Gallery and article browsers | 47 passed in Chromium and WebKit; one Chromium-specific font check skipped in WebKit |
| Production trip reading | 111 passed across desktop Chromium, phone Chromium, and phone WebKit |
| Temperature Python tests | 18 passed |
| Pins Python tests | 48 passed |
| Lint and application TypeScript checks | Passed |
| Dashboard script and test TypeScript checks | Passed with strict checking |
| Production fixture build | Passed, including article JavaScript budgets |
| npm audit | Zero known vulnerabilities |
| Documentation links | 148 Markdown files checked; no missing local targets |
| Line coverage | 88.24% → 88.68% |
| Branch coverage | 82.77% → 83.08% |
| Event-log coverage | 100% of lines, statements, branches, and functions |

The skipped font check requires a Chromium launch flag.
The documentation scan checks target files. It does not validate heading anchors.
Browser checks use fixed content and a test map key.
Linux WebKit uses the existing WPE launcher and cached host libraries.

## Coverage method

Coverage measures loaded source files. It does not prove that every repository module was reviewed.
The comparison uses the same source, Node.js version, compiler, V8 provider, and four-worker limit.
Both comparison runs include watcher lifecycle tests so that they load the same source files.
The first run omits the remaining new regressions. The second run includes them.

The original event-log module had only 12.06% line coverage in the initial tree.
The high repository total concealed that gap.
Tests now exercise its event and output contracts directly.
No coverage thresholds were lowered, and no production source exclusions were added.

## Remaining checks

Use [TODO.md](../../TODO.md) for incomplete work and acceptance conditions.
Hosted analytics, deployed CORS behavior, physical devices, and travel-source facts still need their recorded checks.
This review does not close those tasks.
