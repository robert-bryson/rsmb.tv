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
| `npm run dev` | Start development server (builds flight data first) |
| `npm run build` | Build for production |
| `npm run build-rss` | Generate `public/rss.xml` from the blog registry |
| `npm run build-sitemap` | Generate `public/sitemap.xml` from route and content metadata |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the full Vitest suite |
| `npm run test:coverage` | Run tests with V8 coverage report |
| `npm run watch` | Run terminal operations dashboard (`scripts/aws-watch.tsx`) |
| `npm run build-flights` | Convert flight CSV data to GeoJSON |
| `npm run sync-flights` | Sync flight data from Google Sheets (requires `GOOGLE_SHEET_ID`) |

### Watch Dashboard Controls

The watch dashboard supports the following keys:

- `q` quit
- `h` toggle compact/detail view
- `e` clear event log
- `c` clear resolved incidents
- `↑/↓` or `j/k` scroll in detail mode

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
│   ├── data/           # Generated GeoJSON files
│   ├── rss.xml         # Generated RSS feed
│   └── sitemap.xml     # Generated sitemap
├── infra/              # Terraform infrastructure config
├── scripts/            # Build/sync scripts + dashboard utilities
└── amplify.yml         # AWS Amplify build configuration
```

## Generated Metadata

`public/rss.xml` and `public/sitemap.xml` are generated artifacts. Their timestamps are derived from git history when available, with filesystem metadata as a fallback, so repeat builds do not create timestamp-only diffs.

## Infrastructure

The site is deployed on AWS Amplify with infrastructure managed via Terraform. The Terraform configuration provisions:

- AWS Amplify app connected to GitHub
- Auto-build on push to `main` branch
- Production deployment

> **Note:** Terraform state and variable files containing sensitive data are gitignored and not included in this repository.

## Data

The flights project uses personal travel data stored in CSV format, which is converted to GeoJSON at build time. Airport coordinates are sourced from a separate airports database.

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
