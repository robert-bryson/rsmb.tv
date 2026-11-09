**Intent prefetch implementation, November 9, 2026.**

The implementation follows the [research plan](2026-11-09-intent-prefetch-plan.md).
Selected links prepare destinations after sustained pointer hover or keyboard focus.
Navigation reuses that work through shared module loaders and the existing JSON cache.
The [operating instructions](../intent-prefetch.md) describe configuration, ownership, and resource limits.

This report records the initial implementation before its final review.
The [quality review](2026-11-09-intent-prefetch-quality-review.md) records later fixes and validation.
The timings below apply to the earlier measured builds.
Later release checks found that selector polling inflated the About readiness times.
The earlier activation also used a synthetic click, which excluded input dispatch delay.
Keep the table below as historical evidence. Use the [corrected live comparison](2026-11-09-live-release-verification.md) for current timing claims.

**Behavior and resource ownership.**

Lightweight links use a 150 ms dwell. Explicit map destinations use 300 ms in the `all` mode.
Touch interaction keeps its normal navigation behavior without speculative loading.
Preparation respects document readiness, visible images, hidden tabs, offline state, and supported connection hints.
The scheduler permits one active destination, two queued destinations, and two distinct heavy map attempts per document.
Clicks bypass this scheduler. Canceling intent removes pending work; started imports continue.

Page and article imports retain their existing lazy boundaries.
Article preparation selects one registered body and its trip manifest, when present.
Explicit map preparation loads the actual renderer and its small data allowlist.
It does not construct a map, load geometry collections, request tiles, or fetch full-resolution photos.
Direct Flights, Temperature, and Tornado navigation starts essential data alongside renderer loading.
The `pages` mode leaves speculative map code and data deferred. The `off` mode disables all speculation.

The wrapper preserves router state, aliases, fragments, relative URLs, refs, and composed event handlers.
Hover and focus have separate ownership. Downloads, document reloads, external destinations, and non-self targets skip preparation.
Post and atlas return-location contracts remain intact.

**Failure handling.**

Rejected application loader promises are cleared. Speculative failures remain outside the current page UI.
Existing explicit page-download recovery handles module failures that the browser retains.
JSON warming validates Flight, Temperature, and tornado annual metadata.
Malformed values are discarded by identity, so an older rejection cannot remove a newer refresh.
Every started preparation branch settles before another speculative destination begins.

Vite 8.3.7 retains failed CSS preload entries.
Without a separate retry, a later import can resolve while its map stylesheet remains absent.
The shared loader restores the failed same-origin stylesheet before retrying the module.
MapLibre destinations also recover when a different map caused the original stylesheet failure.
Production tests verify loaded CSS rules, rather than relying on the presence of a stylesheet element.

**Validation.**

| Check | Result |
| --- | --- |
| Full JavaScript suite | 2,808 tests passed across 184 files |
| Python suite | 17 tests passed |
| Type checking and lint | Passed |
| Production prefetch, page recovery, and layout | 30 checks passed in Chromium and WebKit |
| Reading, browsing, atlas, and sharing regressions | 193 checks passed; eight expected platform skips |
| Final reading budgets, embedded map activation, and WebGL fallback | 18 checks passed across desktop Chromium, mobile Chromium, and WebKit |
| Existing Temperature browser suite | 30 passed initially; two timing failures passed on a serial rerun |

The final full suite ran without competing build or browser work.
No test timeout or assertion was weakened.
Local WebKit used compatible libraries in a temporary browser bundle. Repository dependencies and system packages did not change.
CI runs the new production cases through the existing page-recovery command.

**Bundle limits.**

| Resource | Before | Final `all` build |
| --- | ---: | ---: |
| Initial JavaScript, sum of individual gzip bodies | 100,369 bytes | 103,566 bytes |
| Flights renderer, raw | 1,387,675 bytes | 1,387,675 bytes |
| Flights renderer, gzip | 386,615 bytes | 386,614 bytes |

The initial dependency graph adds 3,197 gzip bytes, below the planned 5 KB ceiling.
These figures include statically imported chunks, not just the entry filename.
Bundle comparisons use identical local content in Vite's production-format `test` builds.
The unchanged reading-route and Flights renderer budgets pass.
The one-byte renderer gzip difference comes from changed hashed dependency names.

**Timing comparison.**

The [measurement script](../../scripts/measure-prefetch.js) compares About content and a Flights globe with loaded data.
It uses fresh contexts, 100 ms latency, 10 Mbps downloads, and fourfold CPU slowdown.
The viewport is 1280 × 900 with reduced motion enabled.
Each mode uses ten serial samples per destination and intent window.
The comparison also includes previously visited destinations in the same document.
External services are blocked. Public local Flights data remains available.
Request routing disables HTTP cache. Return visits retain the document's module and application JSON caches.
Return-visit setup waits for active source requests and 500 ms of network quiet.
Exploratory return-visit probes included unfinished source-image transfers and are excluded from the final report.

Small differences need confirmation. Treat changes below 100 ms or 10 percent as inconclusive.
The Flights baseline also has substantial run-to-run variation.
Require its benefit to exceed the baseline interquartile range, which spans the middle half of the samples.
Recheck a no-hover regression above the largest applicable threshold before choosing the default.
The raw report retains every sample, request list, byte count, long-task total, layout shift, duplicate request, and error.
Local preview encoding and emulated hardware differ from production conditions.
These timings do not establish field INP or real-user percentiles.
Synthetic activation can count expected route changes as layout shifts. Recorded shifts are not field CLS measurements.

Cold-context activation-to-readiness medians, in milliseconds:

| Destination | Hover | `off` | `pages` | `all` |
| --- | ---: | ---: | ---: | ---: |
| About | None | 830 | 835 | 826 |
| About | 200 ms | 828 | 838 | 827 |
| About | 500 ms | 834 | 65 | 111 |
| About | 1,000 ms | 831 | 67 | 63 |
| Flights globe with data | None | 2,721 | 2,650 | 2,751 |
| Flights globe with data | 200 ms | 2,330 | 2,502 | 2,314 |
| Flights globe with data | 500 ms | 2,518 | 2,528 | 2,344 |
| Flights globe with data | 1,000 ms | 2,405 | 2,501 | 1,693 |

Previously visited destinations, without hover:

| Destination | `off` median | `all` median |
| --- | ---: | ---: |
| About | 68 ms | 51 ms |
| Flights globe with data | 984 ms | 1,111 ms |

The return-visit globe difference is below its 566 ms baseline interquartile range.
One `all` sample took 4.8 seconds. It remains in the raw report.
These noisy samples do not establish a repeatable change in cached globe startup.
Both return-visit modes transferred zero bytes before the measured activation.

The earlier one-second comparison reported reductions of 768 ms for About and 712 ms for the globe.
The About figure includes selector-polling delay. These deltas must not be used as current responsiveness results.
The corrected live comparison records trusted input and timestamps readiness inside the browser.
The baseline no-hover globe samples have a much wider 503 ms interquartile range.
Its 30 ms difference with `all` remains below the decision thresholds.
The 500 ms globe difference does not exceed its baseline variation. It is inconclusive.

In the one-second `all` scenarios, no intent-phase long tasks above 50 ms were recorded.
This result does not establish the cost of longer hovers, which can finish module evaluation before activation.
The globe still performs substantial main-thread and GPU work after navigation.
Prefetching reduces the download waterfall; it does not eliminate renderer startup.

The one-second About scenario transfers a median 1,779 encoded bytes before activation.
The corresponding Flights scenario transfers 270,194 encoded bytes before activation.
These local preview counts include preparation and expose its cost if intent is abandoned.
Started imports can continue transferring after the pointer leaves. Completed unused preparation can therefore cost more than this snapshot.
Production gzip sizes differ from local preview transfers.

The final report includes 280 samples with no page errors or duplicate script requests.
See the [raw measurements and distributions](../performance/2026-11-09-intent-prefetch.json).
The report includes bundle graphs, all three cold modes, and both return-visit modes.

The default remains `all`, with map preparation restricted to explicit destination links and the documented resource caps.
Use `VITE_INTENT_PREFETCH=pages` to restrict speculation to pages and articles.
Use `off` to disable speculation while retaining shared loaders and direct-entry parallel loading.
The implementation uses existing dependencies.
