# Temperature correctness, page recovery, and startup improvements

Implemented from the November 5 pipeline and project findings.

## Landing page

The leading project card now uses a full-width 16:9 image above its text at all widths.
The layout retains AVIF/WebP sources, accurate responsive `sizes`, intrinsic dimensions, high fetch priority for the leading image, and lazy loading for other cards.
Production browser checks verify card/image bounds at 1280px and 393px.

## Monthly temperatures

The semantic regression originally returned November thresholds of 100°F and −28°F from observations in other seasons. It now returns 82°F and 4°F.
Annual month-to-date samples select complete matching months in prior years. A separate sample includes earlier observations in the current month and excludes the target date.
February anchors on a real leap day, with a separate 1950–51 range. ACIS clamps the annual February 29 sample to February 28 in ordinary years. Daily February 29 comparisons use a four-year interval beginning in 1952, avoiding the invalid original 1950 date and ordinary February 28 observations.
The live API checks confirmed the dated Albany November extremes and ACIS's leap-day behavior. See [ACIS documentation](https://docs.rcc-acis.org/acisws/).

The monthly request cache uses `monthly-v2` keys. Archive and recent-summary headers use `monthlyThresholdVersion: 2`.
Rolling syncs reject old summaries and repair their archived thresholds. Monthly rows now describe the monthly predecessor in their previous-value/date fields.
Tests cover both directions, a hotter summer and colder winter, earlier current-month records, the first day of a month, leap and ordinary Februaries, archive reconstruction, stale summary reuse, and the frontend Monthly filter/count.

The standalone repair command stages every old archive without altering its raw observations. It restores missing station metadata, reuses validated local responses after an interruption, bounds its in-memory historical response cache, and limits concurrent state repairs to four.
For a full backfill it retrieves dated monthly rows for all prior years, reduces each calendar month separately, and caches a compact twelve-month table per state/year. It then shares one current-year daily series per state/month, considering only days before each archive date. This avoids one historical request per archived day without mixing seasons or including later observations.
The follow-up review requires a historical monthly value whenever a daily predecessor proves history exists, in both fresh generation and repair. It validates cached tables for each requested month and verifies omitted current-month stations through bounded dated `StnData` fallbacks. Invalid or unverifiable responses fail before archive replacement.
The workflow can repair all S3 archives before uploading and invalidating `/daily/*` as well as the summaries.
It permits a longer OIDC session only when the archive-repair input is selected.

## Page recovery

The route boundary now sits inside the layout and resets when the pathname changes.
Retry starts a fresh document, preserving the full URL. Session storage tracks up to 32 recent pathnames and allows one reload per tracked pathname per minute; query and fragment changes share the same limit, and there are no automatic reloads.
If session storage is unavailable, the current document keeps its attempt history, but that history cannot survive a document reload.
Navigation remains available after a failed page download. Full-screen map failures include a Home link.
This handles the rejected-loader caching described by [React](https://react.dev/reference/react/lazy).

Production-bundle browser tests passed in Chromium and WebKit for transient downloads, persistent failures, navigation after failure, query/fragment preservation, and the landing-card layout. CI runs both browsers through `PLAYWRIGHT_WEBKIT=1 npm run test:page-recovery`. Local runs use Chromium by default.

## Flights measurements

| Measurement | Baseline | Optimized |
| --- | ---: | ---: |
| Cold readiness, median of three samples | 10,608 ms | 5,257 ms |
| Cold readiness, range | 10,557–10,686 ms | 5,243–5,410 ms |
| Initial Night texture body | 306,974 bytes, requested twice | 54,582 bytes, requested once |
| Terrain texture body | 266,240 bytes, requested twice during startup | 24,662 bytes, deferred |
| Separate startup/interaction budget run | — | 6,012 ms startup; 401 ms maximum across six taps |

Conditions: Chromium 156.0.8078.4, Pixel 7 emulation, 4× CPU slowdown, 150 ms latency, 1.6 Mbps download, 0.75 Mbps upload, disabled browser cache, locally served gzip production bundles, 334 flights.
These are controlled browser measurements, not real-phone field results.
The raw [baseline](../performance/2026-11-05-flight-startup-before.json), [optimized samples](../performance/2026-11-05-flight-startup-after.json), and [budget run](../performance/2026-11-05-flight-startup-budget.json) retain resource timings.

Profiling identified duplicate color/terrain downloads as the largest cost. Initial WebGL context creation was 7–23 ms; that measurement does not represent all GPU initialization.
The flight bundle remained about 380 KB compressed. This pass did not split the renderer bundle.
The texture preloader now matches Three's anonymous CORS mode, permitting request sharing. The Night basemap uses fingerprinted 1536px derivatives. Terrain relief loads after the globe becomes usable.
Regenerate those files with `node scripts/generate-globe-textures.js`, then update their paths in the Night basemap configuration.

The cold-start ceiling is 8.5 seconds and the existing interaction ceiling remains 600 ms.
A run taken concurrently with the full unit suite exceeded the startup ceiling; the isolated rerun passed. Timing comparisons exclude that competing-load run.
All 21 existing Flights controls/basemap browser checks also passed, including texture retry and delayed startup.

## Shared cache

Stored responses have an entry-count capacity of 32 and least-recently-used eviction.
One timer releases expired entries while the app is idle. Reads and writes also prune expired entries.
Pending requests and their generation tokens remain independent, preserving deduplication, invalidation, forced refresh, and retries.
Tests verify idle expiration, capacity eviction, and an in-flight request surviving capacity pressure.
The capacity limits entry count; it is not a byte budget. Real-phone heap measurements remain outstanding.

## Release gate and verification limits

The release workflow validates a production-configured Amplify preview before starting production. Production auto-builds are disabled in the infrastructure definition.
Checks cover deployed revision/job identity, nine direct route visits, configured security/cache headers, asset MIME types, decoding all 58 responsive project images, required-request failures, map readiness, and temperature/tornado/flight data contracts.
Before the follow-up header/readiness expansion, the validator passed a local fixed-data production fixture and rejected deliberately corrupted image bytes. It also caught HTML served for missing fixture image URLs.
Unit checks reject old temperature versions, incompatible tornado aggregates, wrong MIME types, stale revisions, stale build identities, and production startup after failed preview validation.
After a successful report, the release job writes a revision/job-specific proof under the data bucket's `release-validations/` prefix. Production requires this proof, no more than 24 hours old, and the exact matching preview revision and job before and after compilation. A deployed preview alone cannot authorize production.

Activation instructions are in the [release guide](../release-validation.md).
The preview and production rebuild the same Git revision; imported external content is not frozen into a promoted artifact.
AWS infrastructure, GitHub variables, hosted preview validation, and production publication have not been applied in this work session.

The initial implementation run passed 2,624 JavaScript/TypeScript tests and 17 Python pipeline tests, plus type checking, ESLint, a production fixture build, and five mocked Terraform tests.
Those totals precede the follow-up station-coverage, validation-proof, hosting-header, and readiness regressions. They are historical evidence rather than final totals for the expanded change set; use the later review's validation results for that set.

## Local data regeneration

Repaired the seven currently published archives for October 29–November 4, 2026, and rebuilt their rolling summary locally.
All 32,914 daily observations were preserved. The 990 record-breaking observations have the same identities and observed temperatures; monthly classifications increased from 2 to 23. Twenty-two events moved from daily to monthly, while one moved from monthly to daily after accounting for an earlier record in the same month.
The repair recovered 379 station entries absent from the public catalog. The rebuilt summary passes the frontend schema.
The [repair audit](../performance/2026-11-05-temperature-monthly-repair.json) records each date, unchanged observations, and classification transitions.

The original seven-day staging is under `.temp/temperature-monthly-repair/`; `source/` and `previous-recentRecords.json` preserve the public snapshots for comparison.
The project-specific `rsmbtv` AWS profile supplied all 226 archives from March 24–November 4. Their original snapshots remain in `all-source/`.
The earlier `all-daily/` staging predates station-coverage validation and is superseded by a fresh rebuild in `.temp/temperature-review/daily/`.

The refreshed [complete backfill audit](../performance/2026-11-05-temperature-full-backfill.json) verifies the fresh staging against all original archives, records source/output SHA-256 digests, and confirms all 492,101 raw observations and coverage metadata are unchanged. All archived UIDs are present in the merged catalog. All 34,214 reconstructed record identities and observed temperatures are preserved. Historical monthly classifications increase from 275 to 1,558: 1,344 daily events become monthly, and 61 monthly events become daily. Every reconstructed date and the rebuilt rolling summary pass the shared temperature schema.

The coverage audit found 492 observations across six stations absent from prior-year history, all without daily predecessors; these remain valid new-history cases.
It also found 48 observations whose station was omitted from a current-month state response: CA UID 3080 in April, GA UID 5114 in July, IA UID 6703 in October, and WY UID 21733 in May.
Four independently requested, cached `StnData` responses identify the correct UID and every date in each month, with explicit `M` values for both temperatures. The fresh repair uses those verified responses rather than assuming omission means no data. Explicit missing values describe the current upstream response; older archived temperatures remain preserved.

Twelve legacy daily predecessors fall outside the corresponding historical monthly range: five highs above the monthly high and seven lows below the monthly low. Their cause remains unverified; source revisions or differences between historical requests may account for them. None affects October 29–November 4.
These derived snapshots are preserved without coercing one to agree with another. The audit establishes preservation, coverage, schemas, and reconstruction; it does not independently establish complete historical source accuracy or resolve later ACIS corrections.

The fresh rolling summary is `.temp/temperature-review/recentRecords.json`. The merged 6,877-station catalog remains `.temp/temperature-monthly-repair/stations.json`, including 438 recovered entries overall.
No corrected data has been uploaded, and the live release gate has not been activated. Use the [release guide](../release-validation.md) for production rollout.
