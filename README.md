# rsmb.tv

A personal website and portfolio showcasing interactive projects, with a focus on data visualization and geospatial applications.

🌐 **Live site:** [rsmb.tv](https://rsmb.tv)

## Features

- **Flights** — An interactive 3D globe visualization built with [react-globe.gl](https://github.com/vasturiano/react-globe.gl) that displays flights I've taken around the world. Includes active filter chips, opt-in globe rotation, route frequency analysis, and travel statistics.
- **Temperature Records** — An interactive MapLibre GL map of U.S. temperature records. It shows recent station records, standing county and state extremes, and standing-record history.
- **Project Portfolio** — Showcases various side projects including web tools and data visualizations.
- **Blog** — Google-backed MDX posts with RSS, generated Open Graph images, structured data, and shareable tag filters.
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
- npm

Use `nvm install` from the repository root to install and activate the exact Node.js version before installing dependencies. The current toolchain requires Node 22+.

### Installation

```bash
# Clone the repository
git clone https://github.com/robert-bryson/rsmb.tv.git
cd rsmb.tv

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Sync configured blog posts, build flight data, and start development server |
| `npm run build` | Sync blog posts, build generated data/artifacts, typecheck, and build for production |
| `npm run build-blog` | Sync Google-authored posts and rebuild blog RSS/sitemap/OG artifacts |
| `npm run build-rss` | Generate `public/rss.xml` from the blog registry |
| `npm run build-sitemap` | Generate `public/sitemap.xml` from route and content metadata |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the full Vitest suite |
| `npm run test:coverage` | Run tests with V8 coverage report |
| `npm run watch` | Run terminal operations dashboard (`scripts/aws-watch.tsx`) |
| `npm run typecheck` | Run all TypeScript project references without emitting files |
| `npm run build-flights` | Convert flight CSV data to GeoJSON |
| `npm run sync-blogs` | Sync blog metadata from Google Sheets and post bodies from Google Docs |
| `npm run sync-blogs:dev` | Sync blogs before local dev when `GOOGLE_BLOG_SHEET_ID` is configured |
| `npm run sync-flights` | Sync flight data from Google Sheets (requires `GOOGLE_SHEET_ID`) |
| `npm run sync-temperatures` | Generate temperature record JSON for upload to the S3-backed data CDN |
| `npm run sync-tornadoes` | Sync NOAA/NCEI tornado tracks and generated public GeoJSON |
| `npm run test:e2e` | Build flight data, start Vite, and run Playwright browser smoke tests |
| `npm run audit` | Run `npm audit --audit-level=moderate` |

### Status Dashboard Controls

The status dashboard supports the following keys:

- `q` quit
- `h` toggle compact/detail view
- `e` clear event log
- `c` clear resolved incidents
- `↑/↓` or `j/k` scroll in detail mode

Build status is source-aware: AWS Amplify deployments are shown separately from GitHub Actions, and repositories with configured workflow files use those explicit workflows instead of the generic latest repository run. Configured workflows stay visible even before their first run, and stale or unknown workflow rows are treated as attention-worthy instead of being folded into an OK summary.

## Project Structure

```text
├── src/
│   ├── components/     # Shared UI components
│   ├── content/        # Static content (projects list)
│   ├── features/       # Feature modules (e.g., flights)
│   └── pages/          # Route pages
├── projects/
│   └── flights/        # Flight data and conversion scripts
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

`npm run test:e2e` starts Vite directly on `127.0.0.1:4174` with `--strictPort`, then runs Playwright with its internal web server disabled. Set `PLAYWRIGHT_PORT` when that port is already in use. CI installs Chromium before running the browser smoke tests.

Unit tests that exercise `fetchWithCache` or hooks built on it should call `clearCache()` in setup. That helper resets cached responses and detached in-flight requests, so stale async work from one test cannot satisfy or overwrite a later test.

## Generated Metadata

`src/content/posts.json`, `src/content/blog/*.mdx`, `public/rss.xml`, `public/sitemap.xml`, and `public/og/blog/*` are generated artifacts. They are ignored by git and rebuilt from Google Sheets/Docs during local dev and production builds.

Static page Open Graph images are generated from `DEFAULT_PAGES` in `scripts/generate-og-images.js` and committed under `public/og/`. When adding a new project route, add the slug to `src/content/projects.ts`, wire the route in `src/App.tsx`, and add a matching `DEFAULT_PAGES` entry so `npm run build-og` keeps social preview assets complete.

## Project Image Assets

Project screenshots and preview images live under `public/images/<project-slug>/` and should be committed as optimized WebP files. Do not commit raw JPG/PNG capture files when a compressed WebP derivative is used by the site. Project cards expect landscape previews; when the source material is portrait-oriented, compose a landscape preview image instead of pointing the card at a single phone screenshot.

## Private Project Data

Do not commit Ride Ledger source data. The repository ignores `projects/ride-ledger/data/`, `projects/ride-ledger/exports/`, and `projects/ride-ledger/receipts/`. These directories can contain locations, vehicle records, costs, and receipt metadata.

Put only synthetic, de-identified fixtures in a future `projects/ride-ledger/test-data/` directory. Review each fixture before you commit it. Do not copy rows from the source spreadsheet into a fixture.

## Project Changelogs

Project pages read their changelogs from `src/content/projects.ts`. Use the commit history of each project's default branch as the source. Do not include work from an open branch or pull request.

Group changes by month. Put the newest month first. Summarize user-visible changes, reliability work, security fixes, and important maintenance. Set `lastUpdated` to the date of the newest represented commit. The first changelog entry must use the same year and month as `lastUpdated`.

## Flights Map URL State

The flights globe stores shareable app state in query parameters so a copied URL can reopen the same map focus, camera, layers, and display settings. Defaults are omitted from the URL; resetting the camera removes `lat`, `lng`, and `alt` instead of serializing the default view.

Selection parameters are `year`, `airport`, `airline`, `route`, `country`, `region`, and `flightType`. Valid flight type values are `domestic`, `international`, and `intercontinental`; these highlight matching flights while preserving compatible year and airline filters. Location-style focus parameters (`airport`, `route`, `country`, `region`, `flightType`) clear one another so shared links do not encode conflicting map selections.

View and UI parameters include `lat`, `lng`, `alt`, `stats`, `filters`, `help`, `layers`, and `layerSection`. Display and layer parameters include `basemap`, `color`, `anim`, `paths`, `rotation`, `allAirports`, `airportMode`, `usStates`, `stateMode`, and `units=imperial`. Add new shareable flights controls through `useFlightsFilters` so multiple state changes in one interaction compose against the same pending URL draft.

## Flights Stats Panel

The flights stats panel stays mounted when closed. This keeps the slide animation smooth. The closed panel uses `inert` and `aria-hidden`.

On a desktop device, drag the right edge to resize the panel. For keyboard control, focus the edge. Use the Left Arrow or Right Arrow key to change the width by `8` pixels. Use the Home key for the minimum width. Use the End key for the maximum width. The application stores the width in the `flights-stats-panel-width` local storage key. The permitted width is `272` to `520` pixels.

Distance values show the active unit. Hover a distance value to see the alternate unit.

The route "All Flights" list uses incremental rendering. The panel shows an initial subset, then a "Show more" action for the rest.

## Blog Publishing

Google Sheets/Docs is the source of truth for blog content. The build syncs published rows from the Sheet, exports the referenced Google Docs to MDX, then generates RSS, sitemap, and blog OG images before Vite bundles the app. Generated post files are build artifacts and should not be committed. The blog index exposes tags as URL filters (`/blog?tag=Maps`), so tag names should stay concise and reader-facing.

Maintain a Google Sheet tab named `Blog Posts` by default, with one row per post:

| Column | Required | Notes |
| ------ | -------- | ----- |
| `slug` | Optional | URL slug. If empty, the sync derives one from `title`. |
| `title` | Yes | Used in frontmatter, the blog index, RSS, and OG image generation. |
| `date` | Yes | Accepts `YYYY-MM-DD` or `M/D/YYYY`; written as `YYYY-MM-DD`. |
| `description` | Yes | Short summary for previews, RSS, and SEO. |
| `tags` | Yes | Comma- or pipe-separated list. Empty is allowed. |
| `google_doc_id` | Yes | Raw Doc ID or a `docs.google.com/document/d/...` URL. |
| `published` | Yes | Syncs only rows set to `true`, `yes`, `y`, `1`, or `published`. |

### Build-Time Blog Sync

```bash
GOOGLE_BLOG_SHEET_ID=your-sheet-id npm run build-blog
```

Optional environment variables:

- `GOOGLE_BLOG_SHEET_NAME` - Sheet tab name, defaults to `Blog Posts`
- `GOOGLE_BLOG_REPLACE_ALL` - Defaults to `true`. Keep this enabled so the Sheet remains the only blog registry.
- `GOOGLE_BLOG_SYNC_ON_DEV` - Set to `false` to skip the automatic blog sync before `npm run dev`.

`npm run build` runs `npm run build-blog` before typecheck and `vite build`. Amplify Hosting must have `GOOGLE_BLOG_SHEET_ID` configured in its own environment variables; GitHub Actions variables are not visible to Amplify builds.

Amplify builds intentionally run `nvm install` before `npm ci` so CodeBuild installs and activates the exact version pinned in `.nvmrc`, even when the image does not already have it. Do not replace this with `nvm use`; that only works when the requested Node version is preinstalled.

`npm run dev` runs the blog sync first when `GOOGLE_BLOG_SHEET_ID` is available in the shell or local env files. If the sheet is not configured, it skips the sync, rebuilds empty blog artifacts if needed, and starts Vite.

The sync uses public Google export endpoints, matching the existing flight sync model. Share the Sheet and Docs as viewer-accessible to anyone with the link. Private Google Docs would require a separate service-account or OAuth implementation.

Google Docs exports are normalized before writing MDX. The sync preserves headings, lists, links, images, fenced code blocks, simple inline emphasis/highlights, and tables. Active or embedded HTML such as scripts, forms, iframes, objects, SVG, audio, and video is stripped, and links/media are limited to safe URL protocols before generated MDX is written.

### Amplify Content Publishing

Changing a Google Doc does not deploy the site by itself; it only changes the source that the next build will read. To publish without a code commit:

1. In AWS Amplify, open the app and go to **Hosting > Build settings**.
2. Create an incoming webhook for the production branch.
3. Store the webhook URL somewhere private; anyone with it can start a build.
4. Trigger that webhook after publishing content in Google. Options include a small Google Apps Script button/menu in the Sheet, a scheduled Apps Script check, Zapier/Make, or a private admin shortcut.

The webhook should only start an Amplify build. The build itself performs the sync using Amplify environment variables, so generated posts still never pass through Git.

## SEO and Structured Data

Per-page `<head>` is set via the `useDocumentHead` hook (title, description, canonical, OpenGraph/Twitter tags). Page-level [JSON-LD](https://schema.org) is injected via the `useJsonLd` hook. Shared schema fragments (canonical site origin, the author `Person` reference, absolute-URL helper) live in `src/utils/siteMetadata.ts` so every page references the same identity.

Coverage today:

- `WebSite` on the home page
- `ProfilePage` + `Person` on `/about`
- `CollectionPage` containing an `ItemList` of `SoftwareApplication` entries on `/projects`
- `Blog` containing `BlogPosting` entries on `/blog`, plus per-post `BlogPosting` and `BreadcrumbList` on `/blog/:slug`
- `SoftwareApplication` on each project detail page
- `WebPage` on full-screen app subroutes referencing the parent `SoftwareApplication` via `isPartOf`

## Infrastructure

The site is deployed on AWS Amplify with infrastructure managed via Terraform. The Terraform configuration provisions:

- AWS Amplify app connected to GitHub
- Auto-build on push to `main` branch
- Production deployment

> **Note:** Terraform state and variable files containing sensitive data are gitignored and not included in this repository.

## Data

Project data is handled differently depending on how it is authored and updated:

- Flights source data lives in `projects/flights/data/flights.csv` and is converted to ignored GeoJSON files under `public/data/flights/` at build time. Airport coordinates are sourced from a separate airports database.
- Temperature record JSON is generated by `scripts/sync-temperatures.js` and served from the S3-backed CloudFront distribution at `https://data.rsmb.tv`. Generated `public/data/temperatures/*.json` files are local sync artifacts and are not stored in Git.
- Tornado track data is generated from NOAA/NCEI StormEvents and published to the S3/CDN-backed `https://data.rsmb.tv/tornadoes` dataset. The same sync also writes warning/watch analytics from IEM VTEC/SPC archives to `warning-summary.json`. Local `public/data/tornadoes/` files are development/backfill artifacts and are not committed.

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

The script reads previous `recentRecords.json` and `stations.json` from S3/CDN before writing updates, so the rolling recent window and station catalog do not depend on a checked-in data snapshot.

### Flight Data Sync

Flight data is maintained in a Google Sheet and synced to the repository using an automated script. This allows for easy updates when new flights are added.

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

This project is open source. Feel free to use it as inspiration for your own personal site.

## Author

**Robby Bryson** — [rsmb.tv](https://rsmb.tv)

- Geospatial engineer with experience at Microsoft (Azure Maps), federal agencies, and startups
- Based in St. Louis
