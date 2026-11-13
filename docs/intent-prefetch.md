# Intent prefetch

Selected links prepare their destinations before a click.
Pointer hover and keyboard focus start a short timer.
Lightweight links wait 150 ms. Explicit map destinations wait 300 ms.
Navigation shares the prepared modules and JSON requests.

## Configuration

Set `VITE_INTENT_PREFETCH` before the build.

| Value | Preparation |
| --- | --- |
| `all` | Pages, selected articles, and explicit map destinations. This is the default. |
| `pages` | Pages and selected articles. Nested map modules and data wait for navigation. |
| `off` | No preparation before navigation. Direct map visits still load code and data together. |

An unset or empty value selects `all`.
An unknown nonempty value selects `off`.
This rule prevents a configuration error from enabling large downloads.

Use `IntentLink` for selected internal links.
Keep its name explicit in imports and JSX.

| `prefetchMode` | Link behavior |
| --- | --- |
| `page` | Prepare the route module. This is the default. |
| `destination` | Also prepare the selected article, manifest, or allowed map resources. |
| `none` | Disable preparation for this link. |

The wrapper preserves router state, refs, event handlers, keyboard activation, and normal link behavior.
Downloads, document reloads, external destinations, and new-tab links do not start preparation.
Filter links, fragments, and imported article HTML keep their existing behavior.

## Resource limits

| Limit | Value |
| --- | --- |
| Active destination | One |
| Waiting destinations | Two |
| Distinct heavy map attempts | Two per document |
| Diagnostic results | Latest 32, stored in memory |

A destination can request several module dependencies.
Ending intent removes its pending timer or queue entry.
Link changes, unmounting, hidden tabs, and navigation also clear pending work.
A click loads its destination directly. It does not wait behind an unrelated preparation job.

Started dynamic imports cannot be aborted. They also evaluate code.
Longer hovers can move that work onto the current page.
The limits do not make imports background tasks.
Successful modules stay available for the document lifetime.
JSON keeps the shared cache's expiry and capacity limits.

Preparation waits until the document, fonts, and visible images finish loading.
It is skipped when the browser is offline, the tab is hidden, or Save-Data is enabled.
Reported slow-2g and 2g connections also disable preparation.
Heavy preparation is skipped while a foreground map is loading.
Missing connection hints use the same dwell and resource limits.
Touch interaction does not start preparation.

## Allowed resources

| Destination | Prepare before navigation | Load after navigation or feature use |
| --- | --- | --- |
| Ordinary page | Route module and static dependencies | Page images |
| Selected article | One registered body and its trip manifest, when present | Photos, route geometry, and embedded map |
| Flights globe | Renderer, flight records, and visited airports | Optional layers, textures, and GPU initialization |
| Temperature map | Renderer and summary. Also prepare Recent records for the Recent view. | County and state archives, history, tiles, and GPU initialization |
| Tornado map | Renderer, annual summary, and notable events | Historical geometry, analytics, warnings, tiles, and GPU initialization |
| ADV Atlas | Renderer | Routes, tiles, workers, photos, and GPU initialization |
| Pins of Inaccessibility | Renderer | Pin index, geographic outlines, tiles, workers, and GPU initialization |

Camera and filter URL changes do not repeat temperature startup preparation.
Only its data view changes the startup resource selection.
New speculative JSON requests use `priority: 'low'`.
New requests required by navigation use `priority: 'auto'`.
An existing shared request retains its original priority.
These values are browser hints, not bandwidth limits.

## Ownership and recovery

| Module | Responsibility |
| --- | --- |
| `src/navigation/pageLoaders.ts` | Explicit lazy page imports |
| `src/navigation/prefetchTargets.ts` | Known routes, aliases, article identity, and eligibility |
| `src/navigation/intentPrefetch.ts` | Timers, guards, queue, map limits, and diagnostics |
| `src/navigation/prefetchDestination.ts` | Destination preparation after qualified intent |
| Feature `load*Map.ts` files | Renderer imports and startup resources |
| `src/features/temperatures/temperatureDataView.ts` | Shared temperature view classification |
| `src/data/validatedJson.ts` | Validation and safe removal of malformed cached values |

Every production JSON warmer requires a validator.
Validation failures remove only the rejected cached value.
An older failure cannot remove a newer response object.
Tornado event validation also runs during normal map loading.
Malformed optional events leave the required map data available.
The event types come from the same schema.

Speculative failures do not change the current page, navigate, reload, or send analytics.
Visible consumers report their own required-data errors.
The existing page recovery handles retained module failures.
An explicit trip-map retry creates a new lazy component and promise.
A healthy embedded map retains its component when only a requested stop changes.
Tornado URL writers stop when browser history leaves the map's original pathname.
Late camera updates cannot cancel a lazy navigation to the overview.

Vite retains failed CSS preload entries.
The shared loader restores a failed stylesheet before retrying the module.
It accepts only same-origin HTTP or HTTPS CSS URLs without credentials.
The original link remains until its replacement loads.
Retries preserve its nonce, integrity, cross-origin mode, and referrer policy.
An unsuccessful retry cannot remove those attributes from later attempts.

## Validation and measurement

Run the production browser checks:

```bash
PLAYWRIGHT_WEBKIT=1 npm run test:page-recovery
```

These checks cover preparation, request reuse, worker deferral, CSS recovery, and demanded navigation.
The flight route paints a loading status before it mounts a prepared renderer.
Its scheduled startup is canceled if navigation leaves before that paint opportunity.
The trip suite also checks reading budgets and embedded maps.
Use the [repository guide](../README.md#testing-notes) for browser setup.

Build and preview each rollout mode before a local timing comparison.
Run each comparison separately:

```bash
node scripts/measure-prefetch.js --base-url http://127.0.0.1:4189 --label off --out /tmp/prefetch-off.json
```

Use a different output file for each mode.
This helper uses a local HTTP preview. It blocks all external HTTPS requests.
Do not use it against the public HTTPS site.
The script measures About content and a Flights globe with loaded data.
Fresh contexts compare several intent windows. `--warm` revisits a destination in the same document.
Return-visit setup waits for active requests and 500 ms of network quiet.
Request routing disables HTTP cache. Document modules and application JSON still remain cached.

The report records timings, input delay, request lists, transferred bytes, long tasks, layout shifts, duplicates, and errors.
Version 2 uses trusted browser input and includes input queue delay.
It records readiness inside the page after two animation frames.
Test-runner polling and transport delay do not affect that timestamp.
Expected route changes can also appear as layout shifts.
These results are laboratory measurements. They do not establish field INP, CLS, or real-user percentiles.

The [live release check](reviews/2026-11-09-live-release-verification.md) records a controlled production comparison.
It includes the frozen probe source and all 60 samples.
The earlier About timings used coarse selector polling. Use the corrected live comparison for timing claims.
The same report records a prepared-globe input delay and its startup fix.
Code evaluation and renderer long tasks still need checks on physical phones.

See the [historical implementation measurements](reviews/2026-11-09-intent-prefetch-implementation.md),
[quality review](reviews/2026-11-09-intent-prefetch-quality-review.md), and [research plan](reviews/2026-11-09-intent-prefetch-plan.md).
