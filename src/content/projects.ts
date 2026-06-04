export interface ChangelogEntry {
  date: string;
  notes: string[];
}

export interface Project {
  slug: string;
  title: string;
  description: string;
  tech: string[];
  applicationCategory: string;
  featured?: boolean;
  demoUrl?: string;
  sourceUrl?: string;
  previewImage?: string;
  year: number;
  /** ISO date string (YYYY-MM-DD) of the last meaningful update to this project */
  lastUpdated?: string;
  changelog?: ChangelogEntry[];
}

export const projects: Project[] = [
  {
    slug: 'through-routes',
    title: 'Through Routes',
    description: 'Find scenic, twisty motorcycle loop routes on rural roads. Processes OpenStreetMap data to build a loop-friendly road graph, scores roads by curviness and elevation change, and generates ranked circular routes from any start point.',
    tech: ['Python', 'NumPy', 'FastAPI', 'TypeScript', 'MapLibre GL', 'Docker'],
    applicationCategory: 'TravelApplication',
    featured: true,
    demoUrl: 'https://through-routes.rsmb.tv/',
    sourceUrl: 'https://github.com/robert-bryson/through-routes',
    previewImage: '/images/through-routes/through-routes-curviness-map.webp',
    year: 2026,
    lastUpdated: '2026-05-22',
    changelog: [
      { date: '2026-05', notes: ['Added county views pipeline', 'Hardened through-route segmentation', 'Refreshed dependencies'] },
      { date: '2026-04', notes: ['Added route builder connectivity validation', 'Added shareable state and route builder preview', 'Expanded save and restore flows', 'Tightened routegraph security', 'Comprehensive quality, security, and UX improvements', 'Added CSRF protection, type safety improvements, Vitest', 'Added project screenshots'] },
      { date: '2026-03', notes: ['Added to portfolio'] },
    ],
  },
  {
    slug: 'flights',
    title: 'Flights',
    description: 'An interactive 3D globe visualization of flights I\'ve taken around the world. Filter by year, see route frequencies, and explore travel statistics.',
    tech: ['React', 'Three.js', 'WebGL', 'GeoJSON'],
    applicationCategory: 'TravelApplication',
    featured: true,
    demoUrl: '/projects/flights/map',
    previewImage: '/images/flights/flight-globe.webp',
    year: 2025,
    lastUpdated: '2026-05-28',
    changelog: [
      { date: '2026-05', notes: ['Hardened fetch cache request invalidation', 'Improved deferred data loading and verification', 'Hardened URL sharing state', 'Improved map controls and interactions', 'Reworked stats panel UI', 'Performance — lazy-loaded globe component', 'Fixed stale closure in section toggling'] },
      { date: '2026-04', notes: ['Hardened data loading and flight filtering', 'Renamed from \'Flight Tracker\' to \'Flights\'', 'Added preview screenshots'] },
      { date: '2026-02', notes: ['Added all-airports layer and US states overlay'] },
      { date: '2025-12', notes: ['Major refactor — animated arcs, country/region mappings, performance improvements'] },
      { date: '2025-07', notes: ['Initial launch'] },
    ],
  },
  {
    slug: 'anki-artisan',
    title: 'Anki Artisan',
    description: 'Craft Anki flashcard decks from iNaturalist observations and eBird region data. Automatically fetches species photos, audio, and taxonomy to generate visual ID, nomenclature, sound ID, and confusion species cards.',
    tech: ['Python', 'Click', 'eBird API', 'iNaturalist API', 'SQLite'],
    applicationCategory: 'EducationalApplication',
    featured: true,
    sourceUrl: 'https://github.com/robert-bryson/anki-artisan',
    previewImage: '/images/anki-artisan/anki-artisan-preview.webp',
    year: 2026,
    lastUpdated: '2026-05-22',
    changelog: [
      { date: '2026-05', notes: ['Refreshed dependencies'] },
      { date: '2026-04', notes: ['Wired CSV/Wikipedia sources into build pipeline', 'Added dry-run and multi-deck packaging', 'Improved incremental deck updates and metadata tracking', 'Added CSV/Wikipedia extractors', 'Refactored card models and CSS into modules', 'Added taxonomy hierarchy cards and confusion card styling', 'Added CI pipeline'] },
      { date: '2026-03', notes: ['Added project page with screenshots', 'Added to portfolio'] },
    ],
  },
  {
    slug: 'aborg',
    title: 'aborg',
    description: 'A CLI tool to scan, organize, and manage audiobook file collections. Outputs an Audiobookshelf-compatible directory structure with smart filename parsing, metadata extraction, and Libby/OverDrive integration.',
    tech: ['Python', 'Click', 'Mutagen', 'Rich', 'YAML'],
    applicationCategory: 'UtilitiesApplication',
    sourceUrl: 'https://github.com/robert-bryson/aborg',
    year: 2026,
    lastUpdated: '2026-05-11',
    changelog: [
      { date: '2026-05', notes: ['Updated dependencies'] },
      { date: '2026-04', notes: ['Security hardening — zip-slip, corrupt zip, symlink safety', 'Undo batching and crash fixes', 'Expanded test coverage to 71%+', 'Added about/tldr commands', 'Fixed undo crash; hardened organizer safety', 'Improved code quality and test coverage', 'Lint fixes, DRY refactor, variable shadowing fix, coverage improvements', 'Added to portfolio'] },
    ],
  },
  {
    slug: 'parc',
    title: 'parc',
    description: 'A Python CLI for building a long-running podcast archive. Manages feed subscriptions, scans for new episodes, downloads with resumable crash-safe transfers, and audits local archive state.',
    tech: ['Python', 'Click', 'Rich', 'SQLite', 'RSS/OPML', 'Requests'],
    applicationCategory: 'MultimediaApplication',
    sourceUrl: 'https://github.com/robert-bryson/parc',
    previewImage: '/images/parc/update-live-progress.webp',
    year: 2026,
    lastUpdated: '2026-05-21',
    changelog: [
      { date: '2026-05', notes: ['Added resilient podcast archiving', 'Hardened archive integrity', 'Improved feed discovery and scan state UX', 'Improved archive analysis and validation', 'Added to portfolio'] },
    ],
  },
  {
    slug: 'bookend',
    title: 'Bookend',
    description: 'A personal book-tracking app to log reads, organize books into lists, and explore reading stats. Integrates with Google Books, Open Library, and Wikidata for enrichment—covers, descriptions, author links, and more.',
    tech: ['Next.js', 'TypeScript', 'Prisma', 'PostgreSQL', 'Tailwind CSS', 'Docker'],
    applicationCategory: 'LifestyleApplication',
    featured: true,
    demoUrl: 'https://bookend.rsmb.tv',
    sourceUrl: 'https://github.com/robert-bryson/bookend',
    previewImage: '/images/bookend/bookend-home.webp',
    year: 2026,
    lastUpdated: '2026-06-03',
    changelog: [
      { date: '2026-06', notes: ['Refreshed dependencies'] },
      { date: '2026-05', notes: ['Fixed preview array diff bug', 'Added regression tests', 'Added award list data and author award workflow', 'Hardened enrichment action auth', 'Improved read import preview and commit reporting', 'Hardened user state caching', 'Dashboard rhythm/pace improvements'] },
      { date: '2026-04', notes: ['Added project screenshots'] },
      { date: '2026-03', notes: ['Added to portfolio'] },
    ],
  },
  {
    slug: 'temperature-records',
    title: 'Record Highs',
    description: 'Interactive map of recent station records and all-time high/low temperature records across US states and counties, powered by NOAA and ACIS data.',
    tech: ['React', 'MapLibre GL', 'NOAA ACIS', 'GeoJSON'],
    applicationCategory: 'WeatherApplication',
    featured: true,
    demoUrl: '/projects/temperature-records/map',
    previewImage: '/images/temperature-records/records-daily.webp',
    year: 2025,
    lastUpdated: '2026-04-30',
    changelog: [
      { date: '2026-04', notes: ['Fixed temperature data sync; improved data freshness checks', 'Improved map clarity and chart design', 'Fixed HTML sanitization in map popups'] },
      { date: '2026-03', notes: ['Renamed to \'Record Highs\'', 'S3-backed data cache', 'State drill-down', 'Mobile layout improvements', 'Fixed °C/°F unit switching', 'Served data from S3/CloudFront CDN', 'Parallelized ACIS data fetches', 'Overhauled map UX — split views, station detail panel, county labels', 'Initial launch — temperature records map with climate trend charts'] },
    ],
  },
  {
    slug: 'tornado-tracks',
    title: 'Tornado Tracks',
    description: 'A time-first MapLibre archive of NOAA/NCEI tornado tracks with EF-scale filters, regional presets, density mode, and annual playback.',
    tech: ['React', 'MapLibre GL', 'NOAA/NCEI', 'GeoJSON'],
    applicationCategory: 'WeatherApplication',
    featured: true,
    demoUrl: '/projects/tornado-tracks/map',
    previewImage: '/images/tornado-tracks/conus-tracks.webp',
    year: 2026,
    lastUpdated: '2026-05-01',
    changelog: [
      { date: '2026-05', notes: ['Fixed URL state race condition', 'Fixed CDN default and share button', 'Fixed timer memory leak'] },
      { date: '2026-04', notes: ['Initial launch — EF-scale filters, regional presets, density mode, annual playback'] },
    ],
  },
  {
    slug: 'status-dashboard',
    title: 'Status Dashboard',
    description: 'A live terminal monitoring dashboard for AWS infrastructure, GitHub CI builds, and site health. Renders health checks, CloudWatch alarms, build statuses, cost forecasts, and incident logs side-by-side in the terminal using Ink.',
    tech: ['TypeScript', 'React (Ink)', 'AWS SDK v3', 'CloudWatch', 'Route53', 'GitHub API'],
    applicationCategory: 'DeveloperApplication',
    year: 2025,
    lastUpdated: '2026-06-04',
    previewImage: '/images/status-dashboard/status-dashboard-calm.webp',
    changelog: [
      { date: '2026-06', notes: ['Added project page'] },
      { date: '2026-05', notes: ['Hardened GitHub build monitoring; workflow rows surface API errors instead of collapsing to generic failures', 'Explicit workflow configs with no runs render UNKNOWN rows instead of disappearing silently'] },
      { date: '2026-03', notes: ['Added AWS cost forecasting and cost cache versioning', 'Added time-series sparklines and latency tracking to health panel'] },
      { date: '2025-12', notes: ['Added external site health groups and incident log', 'Added GitHub panel for PRs and open issues'] },
      { date: '2025-09', notes: ['Initial launch — health, alarms, builds, and cost panels'] },
    ],
  },
  {
    slug: 'route2gpx',
    title: 'route2gpx',
    description: 'Convert Google Routes into GPX files for GPS devices and bike computers. A privacy-focused web app that runs entirely in your browser—your routes never touch a server.',
    tech: ['JavaScript', 'Leaflet', 'Google Routes API'],
    applicationCategory: 'TravelApplication',
    featured: true,
    demoUrl: 'https://route2gpx.rsmb.tv',
    sourceUrl: 'https://github.com/robert-bryson/route2gpx',
    previewImage: '/images/route2gpx/route-planning.webp',
    year: 2024,
    lastUpdated: '2026-05-22',
    changelog: [
      { date: '2026-05', notes: ['Hardened browser build and import handling', 'Hardened route planner interactions', 'Hardened route export and UI updates', 'Improved test coverage'] },
      { date: '2026-04', notes: ['Refreshed dependencies', 'Production build pipeline — content hashing, SRI, minification', 'Added FIT, TCX, GeoJSON import support', 'Added screenshot gallery', 'Security hardening — CSP refactor, XSS fixes, filename sanitization', 'Added CI pipeline, JS tests, Terraform S3 backend'] },
      { date: '2026-03', notes: ['Added to portfolio'] },
    ],
  },
];

export const featuredProjects = projects.filter(p => p.featured);

/**
 * Returns the project's `lastUpdated` date formatted as "Mon YYYY",
 * or falls back to the `year` field as a string.
 */
export function formatProjectDate(project: Project): string {
  if (project.lastUpdated) {
    const parts = project.lastUpdated.split('-');
    if (parts.length >= 2) {
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    return parts[0];
  }
  return String(project.year);
}
