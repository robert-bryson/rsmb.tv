# Live release check, November 9, 2026

Version 0.3.0 reached production at revision `84a8bc49443ca24cfa07ddc0adc1a465798b62dd`.
The [GitHub workflow](https://github.com/robert-bryson/rsmb.tv/actions/runs/42678178679) passed all three jobs.
Amplify preview build 8 passed hosted validation before production build 433 started.
Both Amplify builds passed. The public deployment record named the expected revision and job.

A separate production check passed all nine release routes and decoded 58 images.
It checked response headers, published data contracts, and interactive map startup.
No application errors were recorded.

## Response time

The comparison used the public production site and real hosted data.
Each destination had ten samples in each of three scenarios: immediate click, one-second hover with preparation disabled, and one-second hover with preparation enabled.
Scenario order alternated between samples. Each sample used a fresh browser context with HTTP cache disabled.
The deployment revision was checked before and after every sample.

The browser was Chromium 158.0.8127.18 at 1280 × 900, with reduced motion enabled.
The probe applied fourfold CPU slowdown, 100 ms of added network latency, 10 Mbps download, and 1 Mbps upload.
Analytics requests were blocked. Other requests used real hosting.

The control set JavaScript `navigator.connection.saveData` to `true`.
It changed no HTTP header or server setting. In the app, this hint disables speculative preparation.
Both control and prepared samples used the same released code and the same network limits.

Median input-to-ready time after a one-second hover:

| Destination | Preparation disabled | Preparation enabled | Reduction |
| --- | ---: | ---: | ---: |
| About | 374 ms | 75 ms | 299 ms, 80% |
| Flight globe with loaded flight data | 2,696 ms | 2,157 ms | 540 ms, 20% |

The About control's middle half ranged from 372 to 377 ms. Prepared samples ranged from 70 to 88 ms.
The globe control's middle half ranged from 2,678 to 2,740 ms. Prepared samples ranged from 2,101 to 2,189 ms.
Every matched hover comparison improved. The smallest savings were 239 ms for About and 448 ms for the globe.

Immediate clicks had median ready times of 386 ms for About and 2,739 ms for the globe.
They started no script requests before activation.
These samples establish current behavior. They are not a corrected before-and-after comparison with the previous release.

Across all 60 samples, there were no application errors, failed requests, or duplicate script downloads.
No worker or WebGL context started before activation.
The intent interval recorded no layout shift or long task above 50 ms.
The largest pointerdown input queue delay was 10.4 ms. Prepared samples stayed below 6.5 ms.
These input checks do not establish field INP.

Preparation moved a median 1,629 encoded bytes before the About click and 258,334 bytes before the globe click.
Started imports can continue after intent ends. These snapshots do not bound the full cost of an abandoned preparation.
The globe still needs about two seconds to start under these CPU and network limits.
Prefetching reduces the loading wait. It does not remove rendering work.

## Measurement correction

The earlier local helper used synthetic `element.click()` activation and test-runner selector polling for About readiness.
Synthetic activation excluded input queue delay. Selector polling added delay to cold readiness results.
The old tables remain in the [historical report](2026-11-09-intent-prefetch-implementation.md), with a correction note.
Do not use those About deltas to quantify the production improvement.

The [local helper](../../scripts/measure-prefetch.js) now sends trusted mouse input with an explicit timestamp.
It records readiness inside the page after two animation frames.
It takes no page evaluation between hover and input, so a busy main thread cannot postpone the measured input silently.
Version 2 reports input queue delay and rejects untrusted activation.
Browser fixtures cover first visits and return visits. They hold the destination incomplete, require trusted input, and delay test-runner polling by 600 ms.

The live comparison used a separate probe because the local helper blocks external HTTPS services.
The [raw production evidence](../performance/2026-11-09-live-prefetch.json) includes all samples, distributions, deployment proof, production validation, and the frozen probe source with its SHA-256 digest.
The first follow-up changes the benchmark helper, tests, and documentation.

## Prepared globe input

Further production probes used 500, 1,500, and 2,000 ms hover windows, with three samples per case.
The 500 ms window did not show a reliable ready-time benefit.
At 1,500 ms, module evaluation overlapped input. Pointerdown queued for 105–115 ms.
Those clicks took 504–560 ms to reach their next paint.
With a 2,000 ms hover, input queued briefly, but globe startup still held the next paint for 320–336 ms.
Prefetching had made the renderer available during navigation, which moved its synchronous startup into the initial response.

The flight route now paints a loading status before mounting the prepared renderer.
Two animation frames provide a paint opportunity. A React transition keeps that status visible while lazy loading resolves.
Leaving the route cancels the scheduled frame. Query changes do not restart the gate.
The data and renderer loaders still share requests through their existing caches.

A local production-format comparison used gzip compression, the same 334 flights and 114 airports, and the same browser limits as above.
With a two-second hover, median click-to-next-paint fell from 312 to 32 ms.
Prepared globe-ready medians were 1,371 ms before and 1,362 ms after. That small ready-time difference is inconclusive.
The comparison used three samples per case.
Immediate-click ready medians were 2,631 ms before and 2,771 ms after, a 140 ms increase of about 5%.
This small comparison does not establish a cold-start regression. Final production checks must retain immediate-click coverage.

Candidate clicks during module evaluation painted within 176–200 ms.
They still queued for 87–101 ms, because painting the loading status does not remove JavaScript evaluation work.
Long renderer tasks also remain after the first paint.
The [startup evidence](../performance/2026-11-09-flight-startup-input.json) retains the production probes, local comparisons, source digests, and all event entries.
Click-to-next-paint uses events with a positive interaction ID. It excludes hover-only events.
These samples are not field INP measurements.

Four page tests cover shared startup data, the initial loading status, and cancellation before either scheduled frame.
The production prefetch and page-recovery suite passed all 18 Chromium checks after the change.
Lint, type checking, and the production-format build passed.

These are laboratory results from a headless desktop browser.
Physical-phone, cellular, memory, and field Web Vitals checks remain in [TODO.md](../../TODO.md#browser-and-performance-checks).
