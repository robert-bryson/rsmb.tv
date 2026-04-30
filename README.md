# rsmb.tv

A personal website and portfolio showcasing interactive projects, with a focus on data visualization and geospatial applications.

🌐 **Live site:** [rsmb.tv](https://rsmb.tv)

## Features

- **Flights** — An interactive 3D globe visualization built with [react-globe.gl](https://github.com/vasturiano/react-globe.gl) that displays flights I've taken around the world. Includes filtering by year, route frequency analysis, and travel statistics.
- **Temperature Records** — An interactive map of U.S. temperature records built with MapLibre GL, showing broken records, county/state all-time records, climate trends, and freshness analysis.
- **Project Portfolio** — Showcases various side projects including web tools and data visualizations.
- **About** — Background on my experience in geospatial engineering and software development.

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS
- **Build:** Vite
- **3D Globe:** react-globe.gl (Three.js/WebGL)
- **Routing:** React Router
- **Infrastructure:** AWS Amplify, Terraform
- **CI/CD:** AWS Amplify auto-builds on push

## Getting Started

### Prerequisites

- Node.js (see `.nvmrc` for version)
- npm

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
|---------|-------------|
| `npm run dev` | Sync configured blog posts, build flight data, and start development server |
| `npm run build` | Build for production |
| `npm run build-rss` | Generate `public/rss.xml` from the blog registry |
| `npm run build-sitemap` | Generate `public/sitemap.xml` from route and content metadata |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the full Vitest suite |
| `npm run test:coverage` | Run tests with V8 coverage report |
| `npm run watch` | Run terminal operations dashboard (`scripts/aws-watch.tsx`) |
| `npm run build-flights` | Convert flight CSV data to GeoJSON |
| `npm run sync-blogs` | Sync blog metadata from Google Sheets and post bodies from Google Docs |
| `npm run sync-blogs:dev` | Sync blogs before local dev when `GOOGLE_BLOG_SHEET_ID` is configured |
| `npm run sync-flights` | Sync flight data from Google Sheets (requires `GOOGLE_SHEET_ID`) |
| `npm run sync-temperatures` | Generate temperature record JSON for upload to the S3-backed data CDN |
| `npm run sync-tornadoes` | Sync NOAA/NCEI tornado tracks and generated public GeoJSON |

### Watch Dashboard Controls

The watch dashboard supports the following keys:

- `q` quit
- `h` toggle compact/detail view
- `e` clear event log
- `c` clear resolved incidents
- `↑/↓` or `j/k` scroll in detail mode

Build status is source-aware: AWS Amplify deployments are shown separately from GitHub Actions, and repositories with configured workflow files use those explicit workflows instead of the generic latest repository run. That keeps scheduled workflows from being counted twice in the attention banner.

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
└── amplify.yml         # AWS Amplify build configuration
```

## Generated Metadata

`public/rss.xml` and `public/sitemap.xml` are generated artifacts. Their timestamps are derived from git history when available, with filesystem metadata as a fallback, so repeat builds do not create timestamp-only diffs.

## Blog Publishing

The blog runtime still reads local MDX files from `src/content/blog/` and metadata from `src/content/posts.json`. Google Docs/Sheets publishing is a sync layer that generates those same local files, so RSS, sitemap, OG image generation, and the Vite build continue to use the existing blog pipeline.

Manual MDX authoring remains supported. To publish through Google, maintain a Google Sheet tab named `Blog Posts` by default, with one row per post:

| Column | Required | Notes |
|--------|----------|-------|
| `slug` | Optional | URL slug. If empty, the sync derives one from `title`. |
| `title` | Yes | Used in frontmatter, the blog index, RSS, and OG image generation. |
| `date` | Yes | Accepts `YYYY-MM-DD` or `M/D/YYYY`; written as `YYYY-MM-DD`. |
| `description` | Yes | Short summary for previews, RSS, and SEO. |
| `tags` | Yes | Comma- or pipe-separated list. Empty is allowed. |
| `google_doc_id` | Yes | Raw Doc ID or a `docs.google.com/document/d/...` URL. |
| `published` | Yes | Syncs only rows set to `true`, `yes`, `y`, `1`, or `published`. |

The first implementation uses public Google export endpoints, matching the existing flight sync model. Share the Sheet and Docs as viewer-accessible to anyone with the link. Private Google Docs would require a separate service-account or OAuth implementation.

Google Docs exports are normalized before writing MDX. The sync preserves headings, lists, links, images, fenced code blocks, simple inline emphasis/highlights, and tables. Active or embedded HTML such as scripts, forms, iframes, objects, SVG, audio, and video is stripped, and links/media are limited to safe URL protocols before the generated MDX is written.

### Manual Blog Sync

```bash
GOOGLE_BLOG_SHEET_ID=your-sheet-id npm run sync-blogs
```

Optional environment variables:

- `GOOGLE_BLOG_SHEET_NAME` - Sheet tab name, defaults to `Blog Posts`
- `GOOGLE_BLOG_REPLACE_ALL` - When `true`, `posts.json` is generated only from the Sheet. By default, existing local posts are preserved and synced rows override matching slugs.
- `GOOGLE_BLOG_SYNC_ON_DEV` - Set to `false` to skip the automatic blog sync before `npm run dev`.

`npm run dev` runs the blog sync first when `GOOGLE_BLOG_SHEET_ID` is available in the shell or local env files. If the sheet is not configured, it skips the sync and starts Vite with the existing local MDX files.

After syncing locally, rebuild generated blog artifacts when needed:

```bash
npm run build-og
npm run build-rss
npm run build-sitemap
```

### Automated Blog Sync

The `Sync Blogs` GitHub Actions workflow can be triggered manually and also runs weekly. Scheduled runs skip cleanly until `GOOGLE_BLOG_SHEET_ID` is configured. Add these as repository variables or secrets before relying on automated publishing:

- `GOOGLE_BLOG_SHEET_ID` - Required Sheet ID
- `GOOGLE_BLOG_SHEET_NAME` - Optional tab name
- `GOOGLE_BLOG_REPLACE_ALL` - Optional source-of-truth mode

When the sync changes content, the workflow rebuilds OG images, RSS, and sitemap files, then commits the generated outputs back to the repository.

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

Temperature record terminology in the UI is deliberately scoped:

- **Recent** shows daily and monthly station records broken yesterday or in the last seven days, compared against the 1950–present ACIS baseline.
- **County All-Time** and **State All-Time** show the highest high and lowest low currently known for each geography.
- **Record Age** colors county all-time records by the decade when the standing record was set.
- **Trends** analyze county all-time records only, not the recent daily/monthly station record feed.

### Temperature Data Sync

Temperature data is maintained outside Git in the `rsmbtv-temperature-data` S3 bucket and served through `data.rsmb.tv`.

The scheduled GitHub Actions workflow runs daily in recent-only mode and monthly in full mode. Recent-only refreshes `recentRecords.json`, daily observation archives, the station index, and ACIS cache files. Full sync also refreshes state records, county records, climate trends, and summary metadata.

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
|-------|------|-------------|
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
