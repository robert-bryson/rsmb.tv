# Flights Lighthouse findings and fixes

Review date: November 6, 2026.
Target: `/projects/flights/map`.
The supplied report used Lighthouse 13.5.0 with desktop emulation and custom throttling on November 5.

## Verified findings

| Finding | Evidence | Change |
| --- | --- | --- |
| Statistics layout shift | Delayed data reproduced CLS 0.0795. The date range and duration rows pushed later sections downward. | Show a loading state inside the fixed-size panel until both required datasets load. Expose `aria-busy`. |
| Airline button contrast | Browser measurement and axe reproduced 3.58:1 white text on the selected orange background. | Darken selected backgrounds. Keep selected airline counts white. Verify labels and counts meet 4.5:1. |
| Heading order | The page skipped from `h1` to `h3`, then used `h4` for statistics sections. | Use `h1`, `h2`, and `h3`. Keep the page heading accessible on phones. |
| Broken skip link | The link received keyboard focus, but its fragment and both fallback selectors had no targets. Activation left focus on the link. | Target the actual statistics toggle and transfer focus on activation. |
| Missing main landmark | The fullscreen layout and flights page contained no `main` element. | Make the flights page a main landmark. |
| Unused preconnects | All three global hints were unused during default globe startup. | Remove the hints from `index.html`. |
| Texture cache lifetime | A live HTTP request confirmed `public, max-age=604800` on the hashed night texture. | Give hashed 1536-pixel earth textures a one-year immutable cache. Preserve seven-day caching for other textures. |
| Serial data loading | Holding the globe module prevented both required GeoJSON requests from starting. | Fetch flight records and visited airports while the module downloads. Reuse the shared cache in map hooks. |
| Accessible names omit visible labels | The newer audit also identified labels missing from the layer, flight-type, and distance buttons' accessible names. | Derive layer and flight-type names from their content. Include the displayed distance in the unit toggle's name. |

The supplied skip-link wording suggested a focusability failure. The actual problem was its missing destination.
The statistics sections identified by Lighthouse were moved elements, rather than the content that caused the shift.
This distinction follows Google's [layout-shift attribution guidance](https://web.dev/articles/optimize-cls#identify_load_cls_issues).

## Performance findings that had already changed

The checkout already used smaller, hashed night and terrain textures, deferred terrain loading, and shared texture requests.
The browser fetched 54,582 bytes for color and 24,662 bytes for terrain, once each.
The supplied report showed approximately 562 KiB for the previous textures.
This review preserves those existing improvements and adds the cache policy.

The WebGL adapter already excludes Three.js WebGPU and TSL code.
Existing production tests enforce the globe bundle budget and verify source-map accuracy.

## Remaining diagnostics

The general globe library still ships code unused during a single initial view.
The audit continues to report approximately 212 KiB of unused JavaScript across the globe and application bundles.
Initial-view coverage cannot establish which code remains unused after filters, basemaps, and optional layers change.
Further byte reduction needs a renderer-level design with behavior and performance comparisons.
This change improves request ordering without claiming a JavaScript size reduction.

The small shared stylesheet remains render-blocking. The saved audits estimate 40 ms before the changes and 80 ms afterward.
Keeping styles on the initial rendering path avoids an unstyled first frame and subsequent layout changes.

Production source maps remain hidden, as configured before this review.
The build emits map files, but omits discovery comments, so Lighthouse continues to report missing source maps.
The existing production test verifies that generated maps resolve application errors to their original sources.

The security suggestions were advisory; the supplied Best Practices score was already 100.
This review preserves the existing CSP and hosting security headers.

## Original Lighthouse validation

The production-optimized local build uses `npx vite build --mode test` and the repository's existing content.
The test mode permits a credential-free build. The default flight globe uses local textures.
The live production deployment was inspected for headers but was not changed.

The comparison uses Lighthouse 13.6.0, a 1350 × 940 desktop viewport, simulated 40 ms RTT, 10,240 Kbps throughput, and 1× CPU.
Both samples use desktop scoring and retain Lighthouse's default mobile user agent.
Each audit starts with browser storage reset. Both builds use the same local origin and flight data.
The supplied custom throttling settings were unavailable, so these local scores cannot be compared directly with its score of 86.
WebGL workload and machine load can also affect timings. These are individual lab samples, not field measurements.
The baseline audit overlapped regression checks. Its performance-score difference does not establish a controlled speed improvement.
LCP excludes canvas contents; it does not measure when the globe becomes usable.
See Google's [list of LCP elements](https://web.dev/articles/lcp#what-elements-are-considered).
Browser tests separately verify canvas visibility, loaded flight counts, and functional controls.

| Metric | Local baseline | Local fixed build |
| --- | --- | --- |
| Performance | 65 | 100 |
| Accessibility | 90 | 100 |
| Best Practices | 100 | 100 |
| SEO | 100 | 100 |
| CLS | 0.0795 | 0 |

The initial regression run failed for the missing landmark, pending statistics state, and button contrast.
The contrast test measured 3.5824:1 before the fix.
The startup regression also failed when the held renderer module prevented data requests.
All these checks pass after the changes. The startup check also verifies one request per required dataset.
The final Lighthouse run also passes the additional accessible-name audit.

Validation includes the full unit suite, Python tests, lint, TypeScript, production builds, and flights browser regressions.
The full suite passed 2,770 JavaScript tests and 17 Python tests.
The flights browser run passed 29 tests. Eight affected browser checks passed again after the accessible-name changes.
The browser checks cover delayed responses, filtered durations, texture retry, camera state, keyboard focus, and narrow viewports.
The flight-duration tests now expect the corrected `h2` statistics headings.

The cache policy takes effect on the next Amplify deployment.
Use the [measurement evidence](../performance/2026-11-06-flights-lighthouse.json) for exact audit settings and metric values.

## Review follow-up

The follow-up reviewed all uncommitted changes against `d1a48a81dfd530c6fc5bd3b5359a684dc85e8d21` on the existing `main` branch.
Independent reviews checked repository standards and the original Lighthouse request.
The findings below describe this follow-up. The earlier Lighthouse results remain historical measurements.

### Standards

| Severity | Finding | Resolution |
| --- | --- | --- |
| P2 | The CLS test accepted an empty measurement array when a browser did not support `layout-shift` entries. | Run this measurement only in Chromium. Assert API support before collecting entries. Release delayed routes when navigation or assertions fail. |
| P3 | The airline expansion button omitted `type="button"` and submitted an enclosing form. The other airline buttons already declared their type. | Add the missing type. Test expansion and collapse inside a form. The test failed before this fix. |
| P3 | The new keyboard test assumed that Tab includes links on macOS WebKit. The browser skips links with that key. | Use Option+Tab on macOS WebKit, as existing post-rendering tests do. Keep actual keyboard navigation in the test. |
| P3 | The report used the baseline stylesheet estimate of 40 ms as its final estimate. The saved final result was 80 ms. | Label both measurements in the report. |

One naming issue was a maintainability judgment, rather than a standards violation.
`StatItem.ariaLabel` no longer supplied an `aria-label` attribute or the complete accessible name.
The prop is now `actionLabel`. The visible label and value remain part of the accessible name.
All callers and tests now use this name.

No further implementation defect, security regression, or documented standards violation was established in the reviewed diff.

### Spec

The request required the implementation to “verify its findings.”
The stylesheet estimate was the only confirmed spec discrepancy. The report now distinguishes the baseline and final values.
The implementation addresses the verified accessibility and layout failures without claiming that unused renderer code was removed.
The review found no missing functional requirement or unrelated feature addition.

Standards: four defects and one naming clarification, all resolved. Spec: one documentation discrepancy, resolved.

### Tests and coverage

Eight new unit cases cover loading states, skip-link navigation, airline selection, form behavior, and page startup.
The page test keeps metadata, request caching, and data hooks real. It replaces the map UI.
It verifies that consumers reuse pending requests and cached responses after remounting.
The loading tests cover both open and closed panels, including `aria-busy`, `aria-hidden`, `inert`, and available controls.
The skip-link tests cover successful focus transfer and native fragment behavior when the target is unavailable.

Both coverage runs use identical final application source and the V8 provider.
The baseline uses 107 existing focused cases. The final run includes all 115 cases.
The baseline excludes the eight new cases, including two additions within `StatsPanel.test.tsx`.

| Focused coverage | Existing cases | With new cases |
| --- | --- | --- |
| Statements | 65.03% | 74.23% |
| Branches | 85.33% | 90.66% |
| Functions | 46.59% | 56.81% |
| Lines | 65.13% | 74.34% |

These percentages cover six reviewed modules, not the complete repository.
`SkipLink`, `AirlinesSection`, and the Flights page now have 100% measured line and function coverage.
Source coverage cannot replace the explicit loading-state and browser assertions.
Use the [coverage record](../performance/2026-11-06-flights-review-coverage.json) for source paths, filters, and counts.

The complete unit run passed 2,778 JavaScript tests across 179 files and 17 Python tests.
Lint, TypeScript, the fixture production build, and whitespace checks passed.
The production-preview browser run passed 57 checks across Chromium and WebKit.
Only the unsupported WebKit CLS measurement is intentionally skipped.
The fixture build uses the existing local flight data and globe textures.
An earlier development-server run reloaded during a contrast measurement. The complete static-preview run passed without retries.
Current flight documentation now shares one browser command and describes these API and keyboard constraints.
