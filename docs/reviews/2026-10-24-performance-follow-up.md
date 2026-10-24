# Live performance and build follow-up: 2026-10-24

## Results

The Flights bundle is smaller, both identified build warnings are resolved, and responsive project previews improve homepage loading.
The OIDC migration is prepared and tested locally. It is not active in AWS or GitHub.

| Change | Before | After |
| --- | --- | --- |
| Flights JavaScript | 2,090,240 bytes | 1,365,989 bytes |
| Flights JavaScript, gzip level 6 | 573,306 bytes | 374,971 bytes |
| Homepage leading image on the simulated phone | 1,147,958 bytes | 299,414 bytes |
| Homepage median LCP | 8.452 seconds, live | 3.404 seconds, local production build |
| Oversized Flights warning | Present | Absent at the existing threshold |
| Broken source-map warning | Present | Absent |

The bundle comparisons use local fixture builds before and after the changes. Compression settings are identical.
The phone selected the 960-pixel preview. The full original image remains available on its project page.

## Browser measurement conditions

Measurements used Chromium 156.0.8078.4 with Pixel 7 emulation and three cold-browser-cache samples per route.
The configured limits were fourfold CPU slowdown, 150 ms latency, 1.6 Mbps downloads, and 0.75 Mbps uploads.
The live target was `https://www.rsmb.tv`. The comparison target was the local production preview.

| Route and metric | Live median | Local median |
| --- | --- | --- |
| Homepage LCP | 8,452 ms | 3,404 ms |
| Homepage CLS | 0.0822 | 0.0822 |
| Homepage sampled INP, project navigation | 200 ms | 192 ms |
| Flights LCP | 1,348 ms | 1,272 ms |
| Flights CLS | 0.000037 | 0.000037 |
| Flights sampled INP, pause animations | 336 ms | 344 ms |
| Flights encoded script bodies | 699,854 bytes | 469,875 bytes |

The raw results are in [live measurements](../performance/2026-10-24-live-mobile.json) and [local measurements](../performance/2026-10-24-local-mobile.json).
These files retain the original tool's results. The [critical review](2026-10-24-critical-review.md) documents later measurement validation and failure checks.
Load metrics are captured before interaction. This prevents a later SPA navigation from replacing the initial-page measurement.

These results are laboratory measurements, not real-device or population percentiles.
The network settings match, but the origins and delivery paths differ. The comparison does not isolate every source of improvement.
Homepage LCP still exceeds the recommended 2.5-second target. See the [LCP guidance](https://web.dev/articles/lcp).
LCP does not measure canvas rendering. The Flights controls and rendered globe were also checked in the production preview.
The pause interaction showed no improvement. Sampled interaction values do not establish full-visit INP or a field percentile.
See the [INP guidance](https://web.dev/articles/optimize-inp).

Repeat the comparison with:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4176 --strictPort
# In a second terminal:
npm run measure:performance -- --paths /,/projects/flights/map --out /tmp/live.json
npm run measure:performance -- --base-url http://127.0.0.1:4176 --paths /,/projects/flights/map --out /tmp/local.json
```

## Implementation and safeguards

### Flights rendering

The upstream globe packages imported WebGPU rendering and GPU heatmap computation alongside WebGL.
This application uses the WebGL renderer and does not use GPU heatmaps.
The guarded build adapter removes those imports and selects the library's existing CPU heatmap calculation.
It uses MagicString to preserve source locations. The critical review added complete source hashes to detect changed upstream implementations.
The build regression also checks that `globe.gl` does not expose a new WebGPU initialization option.

The production-build test limits the Flights chunk to 1,400,000 uncompressed bytes and 400,000 gzip bytes.
It checks that WebGPU and TSL sources are absent. The existing Vite warning threshold was not increased.

### Source maps

Tailwind initially generated CSS without a map because Vite's CSS map setting was disabled.
Enabling that setting exposed a second missing map in Vite's default CSS stage.
The build now enables CSS maps and uses Vite's Lightning CSS transformer.
The regression test checks the final warnings and resolves a generated JavaScript error location to its original TypeScript line.

### Project previews

The generator creates 480-, 960-, and 1440-pixel WebP variants without enlarging source images.
Filenames contain output fingerprints. The generated manifest supplies image dimensions and responsive candidates.
The shared preview module selects candidates for Home and Projects. Leading images load eagerly with high priority.
Other previews load lazily. New cache headers apply only to the fingerprinted preview directory.

### AWS authentication

Read-only account checks confirmed that the existing GitHub OIDC provider is present. No duplicate provider is created.
Two roles restrict trust to this repository's `main` branch and the AWS audience.
Their object permissions separate temperature output from tornado output. Neither role can access the private trip source bucket.
The workflows select OIDC only after their role variable is set. A failed OIDC step cannot invoke the legacy authentication step.
See the [deployment procedure](../github-actions-oidc.md).

## Verification

The final checks use Node.js 24.22.1, npm 12.2.1, Terraform 1.17.0, and AWS provider 6.70.0.
The production build imports the configured published Google content. The content import is read-only.

| Check | Result |
| --- | --- |
| Clean npm install | Passed |
| npm audit / outdated direct dependencies | Zero / zero |
| ESLint / TypeScript | Passed |
| JavaScript and TypeScript tests | 1,249 tests in 93 files |
| Historical Python estimator | 17 tests passed |
| Chromium smoke checks | 11 passed |
| Production trip checks | 48 passed across desktop Chromium, mobile Chromium, and iPhone WebKit |
| Mocked Terraform checks | Three passed, including role trust and project permissions |
| Production build | Passed without the oversized Flights or broken source-map warnings |

## Remaining work

OIDC still requires role deployment, repository variables, and successful workflow runs before legacy credentials can be removed.
Large map modules, MapLibre loading, pause/play latency, and real-device measurements remain in [TODO.md](../../TODO.md).
Content facts, historical source-data approval, and mail delivery checks remain separate publication work.
No live application, infrastructure resource, workflow variable, secret, or source document was changed remotely.
