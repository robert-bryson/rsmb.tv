# CARTO basemaps

All in-repository map projects share [cartoBasemaps.ts](../src/maps/cartoBasemaps.ts).
Trips, ADV Atlas, both temperature maps, Tornado Tracks, and CARTO globe styles use this configuration.
The flights globe also retains its local NASA imagery choices.

## Key configuration

Set `CARTO_API_KEY` in the Amplify build environment.
Amplify runs its own build and reads this configured value.
A local key does not configure Amplify.
CI builds tracked content fixtures with `--mode trip-test` and requires no production credentials.

Vite accepts `CARTO_API_KEY` or the explicit client alias `VITE_CARTO_API_KEY`.
It checks process variables before local files.
Within each source, `VITE_CARTO_API_KEY` takes priority over `CARTO_API_KEY`.
It trims each candidate and skips empty values.
Vite process variables override file values with the same name, including blank values.
Unset a blank process variable to use its file value.
It exposes only this designated basemap key to the application.
Release builds fail if no candidate contains a key.
Other environment secrets remain private.

Use a CARTO **Basemaps browser key** with website restrictions.
Browser tile requests necessarily expose this key.
Do not supply a CARTO platform or administrative credential.
CARTO documents website restrictions and separate development keys in its [basemap authentication guide](https://docs.carto.com/faqs/carto-basemaps).

For local development, place a localhost development key in the ignored `.env.local` file:

```dotenv
CARTO_API_KEY=your-development-basemap-key
```

Local maps without a key use neutral tiles and show **Basemap unavailable**.
They do not send unauthenticated CARTO requests.
Browser tests supply `browser-test-key` and intercept provider responses.
Never use production credentials in browser traces or fixtures.

## Styles and attribution

Raster URLs carry an encoded `key` query parameter.
Tornado Tracks uses CARTO's current hosted dark vector style.
Use the hosted style URL with its `key` parameter.
CARTO maintains the style's tile, font, and icon URLs.
Do not copy those dependent URLs into application code.
See the [CARTO basemap guide](https://docs.carto.com/faqs/carto-basemaps).

Trip styles are **Muted**, **Street**, and **Light**.
The legacy `terrain` identifier remains internal for compatibility; its label now describes the CARTO light style.
It no longer claims to provide topographic contours.

CARTO and OpenStreetMap attribution remains visible on each map.
See [CARTO attribution requirements](https://carto.com/attribution/).
The flights globe shows these links when a CARTO style is active.

The globe loads CARTO tiles directly in the browser.
Changing styles clears its tile cache.
The former bulk texture generator is retired.
CARTO's current [basemap terms](https://carto.com/legal/basemap-terms/index.html) restrict bulk extraction and server-side caching.

## Validation

Unit tests check URL encoding, tile placeholders, and behavior without a key.
They check authenticated raster sources and both provider attribution links.
Blank and whitespace-only keys must produce neutral raster and vector styles.

Configuration tests check key selection and rejection of release builds without a key.
They check whitespace handling, fallback values, and priority between process variables and local files.
They also check that unrelated environment values do not enter the build definitions.

Browser tests verify authenticated requests and visible CARTO and OpenStreetMap links.
They check both link destinations.
The tile fixtures accept only expected CARTO paths. Unknown paths fail the test.

Flight transitions run as separate cases: **Light** to **Voyager**, then **Voyager** to **Night**.
Each case starts with a fresh page and retains the real globe renderer.
The cases use an 800 × 600 viewport, reduced motion, empty flight data, and fixed image responses.
These settings reduce software WebGL work under each default test timeout.
Light tiles are red. Voyager tiles are green. The Night texture is magenta.
The checks require the selected color and reject the previous color.
Blank globes and incorrect styles must fail.

These tests do not verify a production account or its allowed websites.
Live production authorization depends on the configured key and its allowed website origins.
Fixed Night textures verify style selection. They do not verify the NASA image content.

Run the focused checks:

```bash
npx vitest run src/test/cartoBasemaps.test.ts scripts/__tests__/cartoBuildConfig.test.ts
npm run test:e2e -- tests/e2e/carto-basemaps.spec.ts tests/e2e/tornado-map.spec.ts
```

Set `PLAYWRIGHT_WEBKIT=1` to include WebKit in the browser checks.
See [browser setup](../README.md#testing-notes) for ports, browsers, and data generation.
