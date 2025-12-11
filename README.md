# rsmb.tv

A personal website and portfolio showcasing interactive projects, with a focus on data visualization and geospatial applications.

🌐 **Live site:** [rsmb.tv](https://rsmb.tv)

## Features

- **Flight Tracker** — An interactive 3D globe visualization built with [react-globe.gl](https://github.com/vasturiano/react-globe.gl) that displays flights I've taken around the world. Includes filtering by year, route frequency analysis, and travel statistics.
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
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run build-flights` | Convert flight CSV data to GeoJSON |

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
│   └── data/           # Generated GeoJSON files
├── infra/              # Terraform infrastructure config
└── amplify/            # AWS Amplify backend config
```

## Infrastructure

The site is deployed on AWS Amplify with infrastructure managed via Terraform. The Terraform configuration provisions:

- AWS Amplify app connected to GitHub
- Auto-build on push to `main` branch
- Production deployment

> **Note:** Terraform state and variable files containing sensitive data are gitignored and not included in this repository.

## Data

The flight tracker uses personal travel data stored in CSV format, which is converted to GeoJSON at build time. Airport coordinates are sourced from a separate airports database.

## License

This project is open source. Feel free to use it as inspiration for your own personal site.

## Author

**Robby Bryson** — [rsmb.tv](https://rsmb.tv)

- Geospatial engineer with experience at Microsoft (Azure Maps), federal agencies, and startups
- Based in St. Louis
