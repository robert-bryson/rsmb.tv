# rsmb.tv

A personal website with software projects, data maps, writing, and motorcycle trip reports.

**Live site:** [rsmb.tv](https://rsmb.tv)

## Features

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
Use Node.js 22.22.2 or later in line 22. Use Node.js 24.15.0 or later in line 24.
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

### Available Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Prepare local trips, sync published posts and drafts, build flight data, and start Vite |
| `npm run build` | Sync blog posts, build generated data/artifacts, typecheck, and build for production |
| `npm run build-blog` | Sync Google-authored posts and rebuild blog RSS/sitemap/OG artifacts |
| `npm run build-rss` | Generate `public/rss.xml` from the blog registry |
| `npm run build-sitemap` | Generate `public/sitemap.xml` from route and content metadata |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the Vitest suite and the historical temperature pipeline tests |
| `npm run test:temperature-records` | Run the historical temperature pipeline tests |
| `npm run test:coverage` | Run tests with V8 coverage report |
| `npm run watch` | Run terminal operations dashboard (`scripts/aws-watch.tsx`) |
| `npm run typecheck` | Run all TypeScript project references without emitting files |
| `npm run build-flights` | Convert flight CSV data to GeoJSON |
| `npm run sync-blogs` | Sync blog metadata from Google Sheets and post bodies from Google Docs |
| `npm run sync-blogs:dev` | Sync blogs before local dev when `GOOGLE_BLOG_SHEET_ID` is configured |
| `npm run sync-flights` | Sync flight data from Google Sheets (requires `GOOGLE_SHEET_ID`) |
| `npm run sync-temperatures` | Generate temperature record JSON for upload to the S3-backed data CDN |
| `npm run sync-tornadoes` | Sync NOAA/NCEI tornado tracks and generated public GeoJSON |
| `npm run prepare-trip-assets -- <trip-id> --source <directory>` | Create trip image derivatives and sanitized route data |
| `npm run prepare-trip-assets:dev` | Incrementally prepare local trip assets and report the output totals |
| `npm run update-trip-manifest-assets -- <trip-id> --source <directory>` | Apply fingerprinted photo URLs and dimensions to an existing manifest |
| `npm run test:trips:browser` | Build synthetic production content and test trip UX and JavaScript budgets |
| `npm run publish-trip-assets -- <trip-id> --source <directory>` | Archive trip source files and upload reviewed trip assets |
| `npm run test:e2e` | Build flight data, start Vite, and run Playwright browser smoke tests |
| `npm run audit` | Run `npm audit --audit-level=moderate` |

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
Do not override the major version of a dependency declared by React Router DOM.

The ESLint adapter requires TypeScript below 6.1.
The `typescript` package uses the `@typescript/typescript6` alias to meet that requirement.
`npm run typecheck` invokes that package's `tsc6` executable.
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

GitHub Actions use complete commit hashes. Keep each release comment with its verified hash when you update an action.
Infrastructure CI validates all Terraform files. It tests mail, storage, and workflow roles with mocked AWS responses.

## Project Structure

```text
├── src/
│   ├── components/     # Shared UI components
│   ├── content/        # Static content (projects list)
│   ├── features/       # Feature modules (e.g., flights)
│   └── pages/          # Route pages
├── projects/
│   ├── flights/        # Flight data and conversion scripts
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

## Testing Notes

`npm run test:e2e` starts Vite on `127.0.0.1:4174` with a fixed port.
Set `PLAYWRIGHT_PORT` if another process uses that port.
CI installs Chromium and WebKit before browser tests.

Tornado browser tests use fixed tracks and map tiles.
They check phone WebGL, desktop WebGL, and the SVG fallback.
They also check recovery after a failed historical request while phone controls remain open.

The post browser tests use a fixed Google Docs fixture in `tests/fixtures`.
A compilation test compares the fixture MDX with the importer output.
Browser tests check subtitle styles at phone and desktop widths, unique heading IDs, reload, and browser history.
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
This removes cached responses and detached requests between tests.

## Generated Metadata

The build generates post metadata, MDX files, RSS, sitemap, and blog social images.
Git ignores these generated files. Development and production builds import their source content from Google.

Flight GeoJSON files use `metadata.generatedAt` to record the last changed output.
The generators retain the file and timestamp when only the candidate timestamp changes.
They write new output when geometry or other metadata changes.
Repeat-build tests check all three timestamped flight outputs.
Both airport generators reject incomplete numbers, non-finite values, and coordinates outside geographic bounds.
The flight converter omits flights that reference rejected airports.
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
Home and Projects select responsive variants from that manifest. The original images remain available on project detail pages.
The generator resolves source paths before it reads files.
It rejects sources outside `public/images/` and sources inside its output directory.
Do not use generated previews as source images.
Keep `public/images/previews/` as a regular directory. The generator rejects an output directory that is a symbolic link.
It publishes complete images and the manifest through atomic renames.
It removes obsolete generated images after it publishes the manifest.

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
`scriptBytes` counts encoded JavaScript response bodies received before interaction.
It includes module preloads and repeated network transfers. It excludes response headers, stylesheets, and images.
An encoded body retains the server's compression.
`failedSamples` counts failed sample rows. `errors` records failures that affect the complete run, including browser cleanup failures.
The command returns a nonzero status when either field reports a failure.
These are laboratory samples. They do not establish real-device or population performance.

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

View parameters include `lat`, `lng`, `alt`, `stats`, `filters`, `help`, `layers`, and `layerSection`. Display and layer parameters include `basemap`, `color`, `anim`, `paths`, `rotation`, `allAirports`, `airportMode`, `usStates`, `stateMode`, and `units=imperial`. Add URL controls through `useFlightsFilters`. This combines changes from one interaction before the URL updates.

## Flights Stats Panel

The flights stats panel stays mounted when closed. This keeps the slide animation smooth. The closed panel uses `inert` and `aria-hidden`.

On a desktop device, drag the right edge to resize the panel. For keyboard control, focus the edge. Use the Left Arrow or Right Arrow key to change the width by `8` pixels. Use the Home key for the minimum width. Use the End key for the maximum width. The application stores the width in the `flights-stats-panel-width` local storage key. The permitted width is `272` to `520` pixels.

Distance values show the active unit. Hover a distance value to see the alternate unit.

The route "All Flights" list uses incremental rendering. The panel shows an initial subset, then a "Show more" action for the rest.

## Blog publication

Use the [blog publication guide](docs/blog-publishing.md) to configure the Sheet and import documents.
Use the [trip authoring guide](docs/trips/TRIP-AUTHORING-README.md) to prepare photos, routes, manifests, and trip stories.

Production builds import published content before TypeScript checks and Vite compilation.
Direct Vite production builds require the generated post registry. A missing registry stops the build.
Direct Vite development can start without generated content. The post list stays empty until blog sync creates the registry.
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

`useDocumentHead` sets the title, description, canonical URL, and social tags.
`useJsonLd` inserts [JSON-LD](https://schema.org) into the page.
`src/utils/siteMetadata.ts` supplies the shared site origin, author identity, and URL helper.

The pages include these schemas:

- `WebSite` on the home page
- `ProfilePage` + `Person` on `/about`
- `CollectionPage` containing an `ItemList` of `SoftwareApplication` entries on `/projects`
- `CollectionPage` containing all writing and trip reports on `/posts`
- `BlogPosting` and `BreadcrumbList` on `/blog/:slug` and `/trips/:slug`
- `SoftwareApplication` on each project detail page
- `WebPage` on full-screen app subroutes referencing the parent `SoftwareApplication` via `isPartOf`

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

The production site loads Umami Cloud analytics only on `www.rsmb.tv`. The tracker does not load on local or development hosts. It excludes URL query strings and obeys the browser Do Not Track setting.

The content security policy in `infra/main.tf` permits the Umami script and collection endpoint. Apply the Terraform configuration before you enable or change the tracker. Use `terraform -chdir=infra plan` to review the infrastructure change, then use `terraform -chdir=infra apply` to deploy it.

## Data

Each project has a separate data source:

- Flights: `projects/flights/data/flights.csv` supplies flight records. Build scripts write GeoJSON under `public/data/flights/`. A separate airport database supplies coordinates.
- `scripts/sync-temperatures.js` generates temperature record JSON. CloudFront serves the data at `https://data.rsmb.tv`. Git ignores local `public/data/temperatures/*.json` files.
- NOAA/NCEI StormEvents supplies tornado track data. CloudFront serves the data at `https://data.rsmb.tv/tornadoes`. IEM VTEC/SPC archives supply warning and watch statistics in `warning-summary.json`. Git ignores local `public/data/tornadoes/` files.

Local development uses `https://data.rsmb.tv` for temperature data by default. To test freshly generated local temperature JSON instead, set `VITE_TEMPERATURE_DATA_BASE_URL=/data/temperatures` before starting Vite.

The user interface uses these temperature record terms:

- **Recent** shows daily and monthly station records that were broken yesterday or in the last seven days. The comparison average starts in 1950 and ends in the year before each observation.
- **County All-Time** and **State All-Time** show the highest high and lowest low currently known for each geography.
- **Record Age** colors standing county records by broad year ranges.
- **Standing Record History** groups the current county extremes by the year in which they occurred. It does not count records that were later superseded.

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
