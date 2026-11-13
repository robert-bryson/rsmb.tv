# rsmb.tv

A personal website with software projects, data maps, writing, and motorcycle trip reports.

**Live site:** [rsmb.tv](https://rsmb.tv)

## Features

- **[Pins of Inaccessibility](projects/pins-of-inaccessibility/readme.md)** — Explore global interior pins, compare boundary distances, and navigate from local regions to the world.
- **[ADV Atlas](docs/trips/ADV-ATLAS.md)** — Explore motorcycle journeys on a map, browse trip photographs, and open the full reports.
- **Flights** — A globe with flight routes, filters, camera controls, and travel statistics.
- **Temperature Records** — An interactive MapLibre GL map of U.S. temperature records. It shows recent station records, standing county and state extremes, and standing-record history.
- **Tornado Tracks** — Recorded tornado county segments, density maps, annual trends, and warning context. See the [project guide](projects/tornado-tracks/readme.md).
- **Projects** — Software tools, data maps, and project descriptions.
- **Posts** — Writing and trip reports imported from Google documents. Includes RSS, social images, and list filters.
- **Trips** — Motorcycle trip reports with responsive photographs, route maps, accessible galleries, and short animations with playback controls.
- **About** — Background on my experience in geospatial engineering and software development.

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS
- **Build:** Vite
- **3D Globe:** react-globe.gl (Three.js/WebGL)
- **Routing:** React Router
- **Testing:** Vitest, Testing Library, Playwright
- **Infrastructure:** AWS Amplify, Terraform
- **CI/CD:** AWS Amplify auto-builds on push

## Getting Started

### Prerequisites

- Node.js (see `.nvmrc` for version)
- npm 12.2 or a later npm 12 release

Run `nvm install` from the repository root. This installs and activates the Node.js version in `.nvmrc`.
The supported Node.js lines are 22, 24, and 26.
Use Node.js 22.23.5 or later in line 22, 24.22.3 or later in line 24, or 26.13.1 or later in line 26.
See `package.json` for the exact version ranges.
CI and Amplify install the npm version from `packageManager` before they install dependencies.

### Installation

```bash
# Clone the repository
git clone https://github.com/robert-bryson/rsmb.tv.git
cd rsmb.tv

# Install dependencies
nvm install
npm install --global "$(node -p "require('./package.json').packageManager")"
npm ci

# Start development server
npm run dev
```

If generated content is already available, start Vite directly for interface work:

```bash
npx vite --host 0.0.0.0 --port 5173 --strictPort
```

Open [localhost:5173](http://localhost:5173/).
This command skips trip preparation, content imports, and flight generation.
Use `npm run dev` when those inputs need an update.

### Available Scripts

Set a localhost CARTO Basemaps key as `CARTO_API_KEY` in `.env.local` for local maps and release builds.
Amplify uses its configured `CARTO_API_KEY`. CI uses content fixtures and requires no production credentials.
See the [basemap configuration guide](docs/carto-basemaps.md) for styles, attribution, and test behavior.

Selected links prepare their destinations after pointer hover or keyboard focus.
Set `VITE_INTENT_PREFETCH` to `all`, `pages`, or `off` before building.
The default is `all`. Unknown nonempty values disable preparation.
See the [prefetch guide](docs/intent-prefetch.md) for allowed resources, limits, and recovery tests.

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Prepare local trips, sync published posts and drafts, build flight data, and start Vite |
| `npm run build` | Verify tornado publication, sync published posts, generate assets, typecheck, and build for production |
| `npm run build:dev` | Verify tornado publication and build development previews, including incomplete reports |
| `npm run verify-tornado-publication` | Check that published tornado aggregates match the annual summary |
| `npm run verify-temperature-publication` | Check full-sync counts, state coverage, recent dates, and monthly threshold version |
| `npm run build-blog` | Sync Google-authored posts and rebuild blog RSS/sitemap/OG artifacts |
| `npm run build-rss` | Generate `public/rss.xml` from the blog registry |
| `npm run build-sitemap` | Generate `public/sitemap.xml` from route and content metadata |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the Vitest suite and the historical temperature pipeline tests |
| `npm run test:temperature-records` | Run the historical temperature pipeline tests |
| `npm run test:temperatures:browser` | Build and test the temperature map with production assets |
| `npm run test:page-recovery` | Test intent prefetch, page-download recovery, and project layout in a production bundle |
| `npm run test:accessibility` | Scan production reading pages, map controls, and expanded dialogs with axe; check navigation and shortcut settings |
| `npm run test:release-validation` | Test the release validator against local browser failure fixtures |
| `npm run test:coverage` | Run tests with V8 coverage report |
| `npm run watch` | Run terminal operations dashboard (`scripts/aws-watch.tsx`) |
| `npm run typecheck` | Run all TypeScript project references without emitting files |
| `npm run build-flights` | Convert flight CSV data to GeoJSON |
| `npm run build-pins` | Recalculate state, territory, and county pins with the optional Python dependencies |
| `npm run build-pins:world` | Recalculate global country and province pins from the pinned Natural Earth sources |
| `npm run build-pins:context` | Generate elevation and nearby-place files after validating the complete pin inventory |
| `npm run publish-pins:context` | Validate location files and show the publication plan without uploading |
| `npm run test:pins-data` | Check pin geometry, publication validity, locks, and rollback with the optional Python packages |
| `npm run sync-blogs` | Sync blog metadata from Google Sheets and post bodies from Google Docs |
| `npm run sync-blogs:dev` | Refresh published posts and drafts locally when `GOOGLE_BLOG_SHEET_ID` is configured |
| `npm run sync-flights` | Sync flight data from Google Sheets (requires `GOOGLE_SHEET_ID`) |
| `npm run sync-temperatures` | Generate temperature record JSON for upload to the S3-backed data CDN |
| `npm run repair:temperature-archives -- --source <directory> --stations <file> --out <directory>` | Stage corrected monthly thresholds in a separate output tree |
| `npm run validate:release -- --base-url <origin> --revision <sha>` | Validate a hosted preview; see the release guide for activation |
| `npm run sync-tornadoes` | Sync NOAA/NCEI tornado tracks and generated public GeoJSON |
| `npm run prepare-trip-assets -- <trip-id> --source <directory>` | Create trip image derivatives and sanitized route data |
| `npm run prepare-trip-assets:dev` | Incrementally prepare local trip assets and report the output totals |
| `npm run update-trip-manifest-assets -- <trip-id> --source <directory>` | Apply fingerprinted photo URLs and dimensions to an existing manifest |
| `npm run test:trips:browser` | Build synthetic production content and test trip UX and JavaScript budgets |
| `npm run publish-trip-assets -- <trip-id> --source <directory>` | Archive trip source files and upload reviewed trip assets |
| `npm run test:e2e` | Build flight data, start Vite, and run Playwright browser smoke tests |
| `npm run audit` | Run `npm audit --audit-level=moderate` |

The Amplify `dev` branch uses `build:dev`; other branches retain the published-only production build.
Production releases validate `release-preview` before starting the main build. Activate the AWS role, branch settings, and repository variables using the [release guide](docs/release-validation.md).
See Amplify's [branch-specific build commands](https://docs.aws.amazon.com/amplify/latest/userguide/edit-build-settings.html#setting-branch-specific-build-settings-with-scripting).
Both builds verify tornado publication before content imports or bundling.
Publish matching `annual-summary.json` and `trend-index.json` before releasing the frontend.
The check uses `VITE_TORNADO_DATA_BASE_URL` for the selected build mode.
Relative data prefixes resolve inside `public/`. Symlinks cannot escape that directory.
Development builds include editorial preview metadata and mark HTML pages `noindex, nofollow`.
RSS and sitemap files include published posts only, including during development builds.
Hosted previews keep CDN asset URLs; local Vite uses prepared assets under `public/data/trips/`.
Missing manifests, photos, or story bodies remain visible as incomplete atlas cards, with route controls enabled only for validated map data.

### Status Dashboard Controls

The status dashboard supports the following keys:

- `q` quit
- `h` toggle compact/detail view
- `e` clear event log
- `c` clear resolved incidents
- `↑/↓` or `j/k` scroll the dashboard

The dashboard shows AWS Amplify deployments and GitHub Actions separately.
If a repository specifies workflows, the dashboard shows those workflows.
A workflow stays visible before its first run. Old or unknown results require review.

Ink supplies the terminal dimensions and handles resize events.
If the output stream has no dimensions, Ink detects the host terminal size.
If detection fails, Ink uses 80 columns and 24 rows.
The tests use a synthetic stream. They do not contact AWS, GitHub, or external status pages.

## Dependency Maintenance

Use the configured Node.js and npm versions before you update dependencies.
Use normal npm peer dependency checks. The MDX build plugin requires the declared Rollup development dependency.
Keep React and React DOM on the same version.
Keep Vitest and its coverage package on the same version.
Dependabot groups Vitest packages so their updates pass the shared-version contract together.
Do not override the major version of a dependency declared by React Router DOM.

The ESLint adapter requires TypeScript below 6.1.
The `typescript` package stays on the latest supported 6.0 patch series to meet that requirement.
`npm run typecheck` invokes that package's compiler entry directly.
This avoids the shared `tsc` command name also supplied by TypeScript 7.
The separate `@typescript/native` alias supplies TypeScript 7. The lint and typecheck commands do not use it.
Do not replace the lint compiler with TypeScript 7 until the adapter supports it.

After an update, run these checks:

```bash
npm ci
npm run lint
npm run typecheck
npm run audit
npm outdated
npm run test:coverage
npm run test:temperature-records
npm run test:e2e
PLAYWRIGHT_WEBKIT=1 npm run test:trips:browser
```

An empty `npm outdated` result does not prove that every transitive dependency uses its newest release.
Check the audit result and dependency contracts. Do not force incompatible major versions into the dependency tree.
Check aliased compilers and exact security overrides separately. `npm outdated --all` can expose updates hidden by those constraints.

The Pins Python development requirements include the pinned audit tool.
CI audits that file and its resolved dependencies with `pip-audit --strict`.
Dependabot checks the Python requirements each day.
See the [Pins guide](projects/pins-of-inaccessibility/readme.md#validation) for local checks.

GitHub Actions use complete commit hashes. Keep each release comment with its verified hash when you update an action.
The WebGL build adapter also checks reviewed upstream source hashes. Compare the installed bundles before updating those hashes.
It retains the globe's orbit controls and rejects other control types; unused Trackball, Arcball, and Fly controllers are excluded from production.
Infrastructure CI validates all Terraform files. It tests mail, storage, and workflow roles with mocked AWS responses.

### Lint security override

`package.json` pins minimatch 11.0.8 for ESLint, `@eslint/config-array`, and `@typescript-eslint/typescript-estree`.
This scoped override fixes [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
It is a tested exception to those consumers' declared minimatch 10 ranges.

Minimatch 11 removes APIs that these consumers do not use.
They use the retained matching APIs for file discovery, ignored paths, and TypeScript project selection.
The compatibility suite exercises those workflows and checks the advisory's pattern-expansion limit.
Excessive optimization-level-two pattern expansion now throws instead of returning truncated patterns.
It resolves minimatch through each consumer, rather than assuming one shared installation.
Minimatch 11.0.8 supports all Node.js versions listed in the repository's engine ranges.

Run the focused checks after changing the lint toolchain or these overrides:

```bash
npm exec -- vitest run scripts/__tests__/lintDependencyCompatibility.test.ts
npm ls minimatch --all
npm run audit
```

Remove the overrides when all three upstream consumers accept a patched release.
Run the complete dependency checks after removal.
See the [security fix report](docs/reviews/2026-10-31-minimatch-security-fix.md) for the compatibility evidence and validation results.

## Project Structure

```text
├── src/
│   ├── components/     # Shared UI components
│   ├── content/        # Static content (projects list)
│   ├── data/           # Shared JSON request cache
│   ├── features/       # Feature modules (e.g., flights)
│   ├── maps/           # Shared map configuration
│   └── pages/          # Route pages
├── shared/             # Pure modules used by browser code and generators
├── projects/
│   ├── flights/        # Flight data and conversion scripts
│   ├── pins-of-inaccessibility/ # Census boundary calculation and geometry tests
│   └── temperature-records/ # Historical record-rate analysis pipeline
├── public/
│   ├── data/           # Generated/static data files
│   ├── rss.xml         # Generated RSS feed
│   └── sitemap.xml     # Generated sitemap
├── infra/              # Terraform infrastructure config
├── scripts/            # Build/sync scripts + dashboard utilities
├── tests/e2e/          # Playwright browser smoke tests
└── amplify.yml         # AWS Amplify build configuration
```

See the [shared module guide](docs/shared-modules.md) before adding reusable data processing or project presentation code.

## Testing Notes

`npm run test:e2e` starts Vite on `127.0.0.1:4174` with a fixed port.
Set `PLAYWRIGHT_PORT` if another process uses that port.
The runner must start its own server. An occupied port fails startup before tests run.
Flight-data generation requires network access to download the public U.S. state boundaries.
CI installs Chromium and WebKit before browser tests.
Set `PLAYWRIGHT_WEBKIT=1` to include WebKit in the local fixture suite.
Performance measurement tests run only in Chromium because they require its DevTools Protocol.
The flight layout-shift check also requires Chromium's Layout Instability API.
WebKit runs the other flight startup and accessibility checks.
CI also runs trip chapter, gallery, and post-link fixtures in WebKit.
The production page-recovery suite includes axe scans at phone and desktop widths.
Use `PLAYWRIGHT_WEBKIT=1 npm run test:accessibility` to run only those scans and their interaction checks.
Automated scans complement keyboard and assistive-technology testing.
Run the full unit suite before browser suites.
Two unit checks build the production bundle and have 30-second limits.
Parallel local builds can exceed those limits.

Tornado browser tests use fixed tracks and map tiles.
They check phone WebGL, desktop WebGL, and the SVG fallback.
They also check recovery after a failed historical request while phone controls remain open.

Flight tests check duration input, timing-basis counts, filtering, route counts, and current phone details.
They also check filtered airport visits, readable time totals, and keyboard control of statistics sections.
Time checks cover hour and day rounding, partial totals, escaped source details, and consistent labels across React and HTML tooltips.
Phone and desktop checks verify that estimated-only flights show times without estimate labels or method notes.
Duration browser checks use fixed flight and airport data.
Excluded flights have different airlines, years, routes, countries, regions, and flight types.
Each selection has explicit expected counts and times.
Two startup cases delay required data beyond the normal assertion timeout.
See the [flight guide](projects/flights/readme.md#flight-duration) for focused checks.
See the [map code guide](projects/flights/readme.md#map-code) for camera recovery checks and their renderer assertions.
Basemap tests use a fixture browser key and fixed provider responses.
See the [basemap guide](docs/carto-basemaps.md#validation) for the configuration checks and their limits.

The post browser tests use a fixed Google Docs fixture in `tests/fixtures`.
A compilation test compares the fixture MDX with the importer output.
Browser tests check subtitle styles at phone and desktop widths, unique heading IDs, reload, and browser history.
Trip checks cover sticky chapter handoffs, subsection clearance, short screens, and larger-text image sizing.
Post filter tests check country and region links, responsive rows, and long labels at phone widths.
They also check that geographic aliases cannot replace a visible topical tag.
These tests do not require Google access or published trip assets.
Page unit tests use fixed post metadata and trip summaries.
Development-status tests use fixed publication, source, and asset states.
These cases must not depend on a previous Google content import.
ESLint and the development watcher exclude generated coverage and browser reports.
Report writes must not trigger application reloads during browser checks.

`npm run test:trips:browser` builds fixed content for production and checks desktop and phone layouts.
The suite covers maps, photo viewers, accessibility, article metadata, and JavaScript size limits.
Atlas checks include interrupted panel drags, saved table columns, keyboard focus, and control hints after browser history changes.
Use the [trip testing guide](docs/trips/TESTING.md) for browser setup, focused commands, and budget definitions.
CI includes Chromium and iPhone WebKit. Local runs can also include Firefox.

The dashboard tests check terminal height, resize events, keyboard controls, problem reports, recovery, and listener removal.
Run the focused suite with:

```bash
npx vitest run scripts/dashboard/__tests__/App.test.tsx
```

Coverage reports measure loaded source files. They do not measure every repository file.
For a test-coverage comparison, keep the source, compiler, and coverage provider unchanged.
State which tests each measurement includes.

Run the importer and navigation tests with:

```bash
npx vitest run scripts/__tests__/syncBlogs.test.ts scripts/__tests__/googleDocsMdx.test.tsx src/test/mdxComponents.test.tsx
npm run test:e2e -- tests/e2e/post-rendering.spec.ts
```

Call `clearCache()` in tests that use `fetchWithCache` or its hooks.
This clears stored responses and detaches pending requests between tests.
It does not abort network requests.
See the [shared module guide](docs/shared-modules.md#validation) for focused cache, generator, and project-page checks.

## Generated Metadata

The build generates post metadata, MDX files, RSS, sitemap, and blog social images.
Git ignores these generated files. Development and production builds import their source content from Google.

Flight GeoJSON files use `metadata.generatedAt` to record the last changed output.
The generators retain the file and timestamp when only the candidate timestamp changes.
They write new output when geometry or other metadata changes.
Repeat-build tests check all three timestamped flight outputs.
Both airport generators reject incomplete numbers, non-finite values, and coordinates outside geographic bounds.
The flight converter omits flights that reference rejected airports.
Missing or invalid elevations use zero feet and zero meters.
Name mappings use their own nonempty string entries. Unmapped codes remain visible.
See the [flight data guide](projects/flights/readme.md) for input checks.

The image generator reads `DEFAULT_PAGES` in `scripts/generate-og-images.js`.
Commit static page images under `public/og/`.
For a new project, add its slug to `src/content/projects.ts`.
Add its route to `src/App.tsx`. Add its social image entry to `DEFAULT_PAGES`.
Run `npm run build-og`.

## Project Image Assets

Store project screenshots under `public/images/<project-slug>/`.
Commit compressed WebP files. Omit unused source JPG and PNG files.
Use landscape images for project cards. If the source is portrait, prepare a landscape composition.

After you change a project's `previewImage`, run `npm run prepare-project-previews`.
Commit the generated manifest and fingerprinted files in `public/images/previews/`.
Home and Projects select responsive variants from that manifest.

After you publish a trip or change its hero photo, run `npm run prepare-trip-thumbnails`.
First refresh the published post registry and mirror the exact hero source under `public/data/trips/`.
Commit `src/content/trip-thumbnails.json` and `public/images/trip-thumbnails/`.
See [image delivery](docs/image-assets.md) for source checks, encoding settings, atomic writes, error recovery, and preload tests.

## Performance checks

Run controlled browser measurements with:

```bash
npm run measure:performance -- --base-url https://www.rsmb.tv --samples 3 --out /tmp/rsmb-performance.json
```

Use `--paths /,/projects/flights/map` to limit the routes.
The command uses Pixel 7 emulation and fourfold CPU slowdown.
It sets 150 ms latency and 1.6 Mbps downloads. It disables the browser cache.
It records load metrics before interaction. It then measures one named interaction, or keyboard focus when no control is available.
It waits for visible images and fonts before the observation period starts.
Use `--settle-ms` to change the observation period. Use `--timeout-ms` to change readiness and navigation deadlines.
HTTP failures, application crashes, failed visible images, and missing metrics fail the sample.
The JSON report retains failed samples and their causes.
Report files use atomic replacement.
`scriptBytes` counts completed same-origin JavaScript bodies before interaction.
It keeps the server's compression.
The report declares this scope in `conditions.scriptByteScope`.
`externalScriptRequests` counts completed third-party scripts.
The browser can hide third-party body sizes. These responses do not become zero-byte application scripts.
The byte count includes module preloads and repeated requests.
It excludes response headers, stylesheets, and images.
Resource Timing accounts for buffered responses whose incremental CDP byte events are zero.
Completed responses without a Resource Timing entry use their compressed Content-Length when available.
Missing or invalid counters fail the sample.
Map routes also report `mapReady.durationMs` and the first usable `state` (`ready`, `degraded`, or `fallback`).
This timing starts at document navigation. It is separate from LCP, which may describe a loading message.
Atlas waits for route data and worker processing before it reports readiness.
An empty filter result can be ready. Failed route downloads report an error.
Recovered provider failures can produce valid samples with a degraded background.
Fatal renderer errors and terminal map errors still fail the sample.
`failedSamples` counts failed sample rows. `errors` records failures that affect the complete run, including browser cleanup failures.
The command returns a nonzero status when either field reports a failure.
These are laboratory samples. They do not establish real-device or population performance.

Production analytics enables Umami's built-in Web Vitals collection.
Custom `map-ready` and `map-startup-error` events include the feature, build revision, prefetch mode, and viewport class.
Document visits measure from navigation start; client visits measure from the route commit.
Events preserve the originating pathname, exclude query parameters, respect Do Not Track, and tolerate blocked analytics.
Check the production Umami Performance view after deployment; local and preview hosts do not send analytics.

The build uses WebGL rendering and the globe library's existing CPU heatmap fallback.
The guarded build adapter removes unused WebGPU imports. It checks complete source hashes for the two modified dependencies.
Review their upstream diffs before updating an approved hash. Run the adapter tests, production-build test, and browser checks after the update.
The production-build test checks JavaScript size, renderer selection, build warnings, and an original TypeScript error location.
The source-map regression also injects a real Vite diagnostic. The test checks its diagnostic code and message.

## Private Project Data

Do not commit Ride Ledger source data.
Git ignores `projects/ride-ledger/data/`, `projects/ride-ledger/exports/`, and `projects/ride-ledger/receipts/`.
These directories can contain locations, vehicle records, costs, and receipt metadata.

Put only synthetic, de-identified fixtures in a future `projects/ride-ledger/test-data/` directory. Review each fixture before you commit it. Do not copy rows from the source spreadsheet into a fixture.

## Project Changelogs

Project pages read changelogs from `src/content/projects.ts`.
Use commits from each project's default branch as the source.
Exclude work from open branches and pull requests.

Include only new or expanded capabilities. Describe what users can do with each feature.
Exclude dependency updates, tests, CI, refactoring, security hardening, standalone bug fixes, telemetry, data refreshes, documentation, and portfolio changes.

Use this procedure to update a changelog:

1. Find the commit that introduced each capability.
2. Review the commit diff. A later refactor does not change the feature's release month.
3. Group notes by the source commit month. Use `YYYY-MM` and put the newest month first.
4. Omit months without feature updates.
5. Set `lastUpdated` to the newest represented feature commit date. Use a valid `YYYY-MM-DD` calendar date.
6. Check that the first changelog month matches `lastUpdated`.
7. Put each note on a separate source line in its `notes` array.

The project list shows the feature update month. Projects without `lastUpdated` show their launch year.
Each changelog note has a bullet, including months with one note. Wrapped text aligns with the note text.
Dates use UTC calendar values. Invalid date text remains visible for correction; formatters do not normalize it.
The content tests reject invalid calendar dates and changelog months.

Run the date and project checks after an edit:

```bash
npx vitest run src/test/formatDate.test.ts src/test/projects.test.ts src/test/Projects.test.tsx src/test/ProjectChangelog.test.tsx src/test/pages.test.tsx src/test/projectPages.test.tsx
npm run test:e2e -- tests/e2e/projects.spec.ts
```

## Flights Map URL State

The flights globe stores selections, camera position, layers, and display settings in query parameters.
Copied URLs restore these settings. The URL omits default values.
A camera reset removes `lat`, `lng`, and `alt`.

Selection parameters are `year`, `airport`, `airline`, `route`, `country`, `region`, and `flightType`.
Flight types are `domestic`, `international`, and `intercontinental`. These retain compatible year and airline filters.
Only one of `airport`, `route`, `country`, `region`, or `flightType` can control the focus.

| Parameter group | Values |
| --- | --- |
| View | `lat`, `lng`, `alt`, `stats`, `filters`, `help`, `layers`, `layerSection` |
| Display and layers | `basemap`, `color`, `anim`, `paths`, `rotation`, `allAirports`, `airportMode`, `usStates`, `stateMode`, `units=imperial` |

Add URL controls through `useFlightsFilters`.
This combines changes from one interaction before the URL updates.

## Flights Stats Panel

The statistics panel opens by default. Use `stats=0` to share a closed-panel view.
The flights stats panel stays mounted when closed.
This keeps the slide animation smooth.
The closed panel uses `inert` and `aria-hidden`.

On a desktop device, drag the right edge to resize the panel.
For keyboard control, focus the edge.
Use the Left Arrow or Right Arrow key to change the width by `8` pixels.
Use the Home key for the minimum width.
Use the End key for the maximum width.
The application stores the width in the `flights-stats-panel-width` local storage key.
The permitted width is `272` to `520` pixels.

Distance values show the active unit. Hover a distance value to see the alternate unit.

The route "All Flights" list uses incremental rendering. The panel shows an initial subset, then a "Show more" action for the rest.
Flight dates display only their year in statistics, route histories, map tooltips, and mobile details.
Full dates remain in the flight data for chronological sorting and selecting first and last visits.

## Blog publication

Use the [blog publication guide](docs/blog-publishing.md) to configure the Sheet and import documents.
Use the [trip authoring guide](docs/trips/TRIP-AUTHORING-README.md) to prepare photos, routes, manifests, and trip stories.

Production builds import published content before TypeScript checks and Vite compilation.
Direct Vite production builds require the generated post registry. A missing registry stops the build.
Direct Vite development can start without generated content. The post list stays empty until blog sync creates the registry.
CI uses `npx vite build --mode trip-test` with tracked content fixtures. This check requires no Google access or CARTO credentials.
Configure `GOOGLE_BLOG_SHEET_ID` in Amplify. GitHub Actions variables do not configure Amplify.
The Amplify build runs `nvm install` before `npm ci` to activate the version in `.nvmrc`.
It then installs the npm version from `packageManager` before dependency installation.

Maps first show a route preview. Interactive maps load when their sections enter the viewport.
The route cache shares active requests and removes unused entries when its size exceeds eight.
Active readers can temporarily require more entries.
Story gallery viewers follow the mounted galleries in document order.
They include collapsed photos and retain each photo's alt text.
The hero viewer contains every manifest photo. Inline photos use separate viewers.

## Documentation rules

Use the [documentation index](docs/README.md) for writing rules, current procedures, and dated reviews.
Keep incomplete work in [TODO.md](TODO.md). Use Git history for completed work.

## SEO and Structured Data

Public pages include titles, descriptions, canonical URLs, social tags, and JSON-LD before JavaScript runs.
React uses the same metadata definitions during navigation. The browser renders page bodies.
Project previews use each project's screenshot. Trip reports use their hero photo. Other pages use PNG social cards.
The site also publishes RSS and JSON Feed, browser identity through a web manifest, and author profile links.

The [metadata guide](docs/site-metadata.md) describes source files, schemas, route handling, and required checks.
It also explains development indexing rules and hosting requirements.
Deploy generated HTML with the rewrite rules in `infra/main.tf`.
The [review index](docs/README.md) links dated findings and validation results.

## Infrastructure

AWS Amplify deploys the site. Terraform manages the infrastructure. The configuration provisions:

- AWS Amplify app connected to GitHub
- Auto-build on push to `main` branch
- Production and development domains
- An AWS Amplify managed TLS certificate for automatic renewal
- CloudFront distributions for the apex redirect and public data

> **Note:** Git ignores Terraform state and variable files that can contain sensitive data.

### Email DNS

Google Workspace sends and receives mail for `@rsmb.tv`.
Route 53 hosts the DNS zone.
Terraform defines SPF, DKIM, and monitoring-only DMARC records in [infra/mail.tf](infra/mail.tf).
The existing MX record remains outside Terraform.

Use the [email DNS guide](docs/email-dns.md) for record adoption, offline tests, signing checks, and key rotation.
Check Terraform state before you apply these records. Existing DNS records must not be recreated or overwritten without review.

## Analytics

Production loads Umami Cloud only on `www.rsmb.tv`. The tracker excludes query strings and hashes. It respects Do Not Track, Global Privacy Control, and the local opt-out. See the [analytics contract](docs/umami-analytics.md) for events, privacy rules, and dashboard checks.

The content security policy in `customHttp.yml` permits the Umami script and collection endpoint. The Amplify configuration also reads that file from `infra/main.tf`. Review the hosting configuration when you change the policy.

## Data

Each project has a separate data source:

- Flights: `projects/flights/data/flights.csv` supplies flight records. Build scripts write GeoJSON under `public/data/flights/`. A separate airport database supplies coordinates.
- `scripts/sync-temperatures.js` generates temperature record JSON. CloudFront serves the data at `https://data.rsmb.tv`. Git ignores local `public/data/temperatures/*.json` files.
- NOAA/NCEI StormEvents supplies tornado track data. CloudFront serves the data at `https://data.rsmb.tv/tornadoes`. IEM VTEC/SPC archives supply warning and watch statistics in `warning-summary.json`. Git ignores local `public/data/tornadoes/` files.

Local development uses `https://data.rsmb.tv` for temperature data by default. To test freshly generated local temperature JSON instead, set `VITE_TEMPERATURE_DATA_BASE_URL=/data/temperatures` before starting Vite.

The user interface uses these temperature record terms:

- **Recent** shows daily and monthly station records that were broken yesterday or in the last seven days. The comparison average starts in 1950 and ends in the year before each observation.
- **County Extremes** and **State Extremes** show standing county extremes and certified state records.
- **Record Age** colors standing county records by broad year ranges.
- **Standing Record History** groups the current county extremes by the year in which they occurred. It does not count records that were later superseded.

The Recent view draws each station record as a red high marker or blue low ring.
It does not cluster nearby records. Temperature labels appear where they fit without overlapping other labels.
See the [temperature map guide](docs/temperature-map.md) for controls, code ownership, and regression tests.

### Temperature Data Sync

Temperature data is maintained outside Git in the `rsmbtv-temperature-data` S3 bucket and served through `data.rsmb.tv`.

The scheduled GitHub Actions workflow runs each day in recent-only mode and each month in full mode. Recent-only mode refreshes `recentRecords.json`, the daily observation archives, the station index, and the ACIS cache files. Full mode also refreshes state records, county records, standing-record history, and summary metadata. The history output includes each calendar year from 1890 through the current year. Years with no surviving record have zero counts.

#### Manual Temperature Sync

```bash
# Recent records only
TEMPERATURE_DATA_BUCKET=rsmbtv-temperature-data npm run sync-temperatures -- --recent-only

# Recent records with a larger recovery window, up to 366 days
TEMPERATURE_DATA_BUCKET=rsmbtv-temperature-data npm run sync-temperatures -- --recent-only --backfill-days=14

# Full state/county/trend refresh
TEMPERATURE_DATA_BUCKET=rsmbtv-temperature-data npm run sync-temperatures
```

The script reads previous `recentRecords.json` and `stations.json` from S3/CDN before it writes updates.
The recent window and station catalog do not require a data snapshot in Git.

### Flight Data Sync

A Google Sheet contains the flight data.
An automated script imports the data into the repository.

#### Manual Sync

```bash
GOOGLE_SHEET_ID=your-sheet-id npm run sync-flights
```

#### Automated Sync (GitHub Actions)

A GitHub Actions workflow runs nightly to:

1. Fetch the latest data from Google Sheets
2. Run QA/QC validation checks
3. Commit any changes to the repository
4. Rebuild and deploy the site if data changed

To set up automated sync, add these secrets to your GitHub repository:

- `GOOGLE_SHEET_ID` — The ID from your Google Sheet URL
- `GOOGLE_SHEET_NAME` — (optional) Sheet tab name, defaults to "Flights"

#### QA/QC Validation

The sync script validates all flight data:

| Check | Type | Description |
| ----- | ---- | ----------- |
| Date format | Error | Must be M/D/YYYY |
| Date range | Error | Must be 1990 – 1 year from now |
| Airport codes | Error | Must be 3-4 letter IATA/ICAO codes |
| Same origin/dest | Error | Origin and destination must differ |
| Empty airline | Warning | Informational only |
| Duplicate flights | Warning | Same date + route flagged |
| Airline naming | Warning | Inconsistent names are normalized |

The script also normalizes data (trims whitespace, uppercases codes, sorts by date) and removes empty columns.

#### Expected CSV Format

```csv
date,airline,flightNumber,origin,destination
6/15/2008,Continental Airlines,,LAX,IAH
7/19/2009,Swiss,LX 41,LAX,ZRH
```

## License

This repository has no license file.

## Author

**Robby Bryson** — [rsmb.tv](https://rsmb.tv)

- Geospatial engineer with experience at Microsoft (Azure Maps), federal agencies, and startups
- Based in St. Louis
