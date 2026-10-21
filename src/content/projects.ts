import { formatMonthYear } from '../utils/formatDate';

export interface ChangelogEntry {
  /** Feature month (YYYY-MM), in descending order within each project. */
  date: string;
  notes: string[];
}

export interface Project {
  slug: string;
  title: string;
  description: string;
  /** Short description used when the project appears in a compact card. */
  summary?: string;
  tech: string[];
  applicationCategory: string;
  featured?: boolean;
  demoUrl?: string;
  sourceUrl?: string;
  previewImage?: string;
  year: number;
  /** ISO date (YYYY-MM-DD) of the newest feature update represented in the changelog. */
  lastUpdated?: string;
  changelog?: ChangelogEntry[];
}

export const projects: Project[] = [
  {
    slug: 'through-routes',
    title: 'Through Routes',
    description: 'Find scenic, twisty motorcycle loop routes on rural roads. Processes OpenStreetMap data to build a loop-friendly road graph, scores roads by curviness and elevation change, and generates ranked circular routes from any start point.',
    summary: 'Generate ranked motorcycle loops using road curviness, elevation, and OpenStreetMap data.',
    tech: ['Python', 'NumPy', 'FastAPI', 'TypeScript', 'MapLibre GL', 'Docker'],
    applicationCategory: 'TravelApplication',
    featured: true,
    demoUrl: 'https://through-routes.rsmb.tv/',
    sourceUrl: 'https://github.com/robert-bryson/through-routes',
    previewImage: '/images/through-routes/through-routes-curviness-map.webp',
    year: 2026,
    lastUpdated: '2026-10-02',
    changelog: [
      {
        date: '2026-10',
        notes: [
          'Added theme controls and a dark vector basemap',
        ],
      },
      {
        date: '2026-05',
        notes: [
          'Added county road views',
        ],
      },
      {
        date: '2026-04',
        notes: [
          'Added shareable map state and route builder previews',
          'Expanded route saving and restoration',
          'Added route builder connectivity checks',
          'Added native Windows support for road-data processing',
        ],
      },
    ],
  },
  {
    slug: 'flights',
    title: 'Flights',
    description: 'An interactive 3D globe visualization of flights I\'ve taken around the world. Filter by year, see route frequencies, and explore travel statistics.',
    summary: 'Explore my flight history on an interactive 3D globe with filters and travel statistics.',
    tech: ['React', 'Three.js', 'WebGL', 'GeoJSON'],
    applicationCategory: 'TravelApplication',
    featured: true,
    demoUrl: '/projects/flights/map',
    previewImage: '/images/flights/flight-globe.webp',
    year: 2025,
    lastUpdated: '2026-08-20',
    changelog: [
      {
        date: '2026-08',
        notes: [
          'Added pointer and keyboard resizing to the stats panel, with saved sizing preferences',
        ],
      },
      {
        date: '2026-05',
        notes: [
          'Added active filter chips',
          'Added a globe rotation toggle',
          'Added a pull-tab control for opening and closing the stats panel',
        ],
      },
      {
        date: '2026-02',
        notes: [
          'Added all-airports layer and US states overlay',
        ],
      },
      {
        date: '2025-12',
        notes: [
          'Added animated flight arcs and country and region labels',
        ],
      },
      {
        date: '2025-07',
        notes: [
          'Initial launch',
        ],
      },
    ],
  },
  {
    slug: 'anki-artisan',
    title: 'Anki Artisan',
    description: 'Craft Anki flashcard decks from iNaturalist observations and eBird region data. Automatically fetches species photos, audio, and taxonomy to generate visual ID, nomenclature, sound ID, and confusion species cards.',
    summary: 'Build media-rich wildlife flashcards from iNaturalist observations and eBird region data.',
    tech: ['Python', 'Click', 'eBird API', 'iNaturalist API', 'SQLite'],
    applicationCategory: 'EducationalApplication',
    featured: true,
    sourceUrl: 'https://github.com/robert-bryson/anki-artisan',
    previewImage: '/images/anki-artisan/anki-artisan-preview.webp',
    year: 2026,
    lastUpdated: '2026-04-30',
    changelog: [
      {
        date: '2026-04',
        notes: [
          'Added flashcard generation from CSV files and Wikipedia tables',
          'Added dry-run previews without media downloads or deck output',
          'Added multi-source builds with separate subdecks',
          'Added incremental builds that export only new or changed cards',
          'Added seasonal and difficulty tags for targeted study',
        ],
      },
      {
        date: '2026-03',
        notes: [
          'Added wildlife flashcard generation from iNaturalist and eBird',
          'Added interactive eBird region lookup',
          'Added taxonomy hierarchy cards',
        ],
      },
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
    lastUpdated: '2026-04-16',
    changelog: [
      {
        date: '2026-04',
        notes: [
          'Added about and tldr commands for version details and command reference',
          'Added audiobook discovery from metadata.json sidecars in directories and ZIP archives',
          'Added configurable author-name formatting with automatic folder renaming',
          'Added optional source-file and empty-directory cleanup after organizing',
        ],
      },
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
    lastUpdated: '2026-09-29',
    changelog: [
      {
        date: '2026-09',
        notes: [
          'Added episode-source provenance and feed snapshot management',
          'Added quick, changed-file, and full-checksum archive analysis modes',
          'Added archive-health reporting with parc doctor',
          'Added scheduled Synology updates and a fail-on-error option for schedulers',
        ],
      },
      {
        date: '2026-05',
        notes: [
          'Added podcast subscriptions, episode scanning, and resumable downloads',
          'Added archive backup, restore, integrity, status, and recovery commands',
          'Added historical feed backfill and multi-source feed discovery',
          'Added OPML subscription import',
          'Added concurrent downloads with fair scheduling and bandwidth limits',
          'Added stale-episode reporting and per-podcast archive analysis',
        ],
      },
    ],
  },
  {
    slug: 'bookend',
    title: 'Bookend',
    description: 'A personal book-tracking app to log reads, organize books into lists, and explore reading stats. Integrates with Google Books, Open Library, and Wikidata for enrichment—covers, descriptions, author links, and more.',
    summary: 'Track reading, organize book lists, and enrich library data from multiple open APIs.',
    tech: ['Next.js', 'TypeScript', 'Prisma', 'PostgreSQL', 'Tailwind CSS', 'Docker'],
    applicationCategory: 'LifestyleApplication',
    featured: true,
    demoUrl: 'https://bookend.rsmb.tv',
    sourceUrl: 'https://github.com/robert-bryson/bookend',
    previewImage: '/images/bookend/bookend-home.webp',
    year: 2026,
    lastUpdated: '2026-05-08',
    changelog: [
      {
        date: '2026-05',
        notes: [
          'Added award-list data and author award workflows',
          'Added a Reading Home dashboard with current books, reading goals, and activity history',
          'Added weekly reading pace, monthly charts, and reading insights',
          'Added list-progress tracking for award winners, finalists, and nominees',
        ],
      },
    ],
  },
  {
    slug: 'temperature-records',
    title: 'U.S. Temperature Records',
    description: 'Explore recent station record events, observed county extremes, certified state extremes, and the ages of standing records.',
    tech: ['React', 'MapLibre GL', 'NOAA ACIS', 'GeoJSON'],
    applicationCategory: 'WeatherApplication',
    demoUrl: '/projects/temperature-records/map',
    previewImage: '/images/temperature-records/records-daily.webp',
    year: 2025,
    lastUpdated: '2026-09-08',
    changelog: [
      {
        date: '2026-09',
        notes: [
          'Added standing-record summaries with median age and the share set in the last 25 years',
          'Added historical record analysis with station cohorts and quality checks',
        ],
      },
      {
        date: '2026-03',
        notes: [
          'Added state drill-down and monthly record scope',
          'Added separate map views for recent records, county extremes, state extremes, and record ages',
          'Added station detail panels and county labels',
          'Launched the temperature records map with record-history charts',
        ],
      },
    ],
  },
  {
    slug: 'tornado-tracks',
    title: 'Tornado Tracks',
    description: 'A time-first MapLibre archive of NOAA/NCEI tornado tracks with EF-scale filters, regional presets, density mode, and annual playback.',
    tech: ['React', 'MapLibre GL', 'NOAA/NCEI', 'GeoJSON'],
    applicationCategory: 'WeatherApplication',
    demoUrl: '/projects/tornado-tracks/map',
    previewImage: '/images/tornado-tracks/conus-tracks.webp',
    year: 2026,
    lastUpdated: '2026-04-29',
    changelog: [
      {
        date: '2026-04',
        notes: [
          'Launched tornado-track exploration with EF-scale filters, regional presets, density mode, and annual playback',
          'Added tornado trends, fatality comparisons, and warning and watch summaries',
          'Added an interactive fallback map for devices without WebGL',
        ],
      },
    ],
  },
  {
    slug: 'status-dashboard',
    title: 'Status Dashboard',
    description: 'A live terminal monitoring dashboard for AWS infrastructure, GitHub CI builds, and site health. Renders health checks, CloudWatch alarms, build statuses, cost forecasts, and incident logs side-by-side in the terminal using Ink.',
    tech: ['TypeScript', 'React (Ink)', 'AWS SDK v3', 'CloudWatch', 'Route53', 'GitHub API'],
    applicationCategory: 'DeveloperApplication',
    year: 2025,
    lastUpdated: '2026-04-21',
    previewImage: '/images/status-dashboard/status-dashboard-calm.webp',
    changelog: [
      {
        date: '2026-04',
        notes: [
          'Added compact and detail views for health, alarms, builds, and AWS cost forecasts',
          'Added external uptime monitoring and GitHub pull request and issue panels',
          'Added AWS resource monitoring with CloudFront and Lambda discovery',
          'Added health-check latency sparklines',
          'Added 24-hour incident history and a command to clear resolved incidents',
          'Added event logging and automatic problem details in compact mode',
        ],
      },
    ],
  },
  {
    slug: 'route2gpx',
    title: 'route2gpx',
    description: 'Convert Google Routes into GPX files for GPS devices and bike computers. A privacy-focused web app that runs entirely in your browser—your routes never touch a server.',
    tech: ['JavaScript', 'Leaflet', 'Google Routes API'],
    applicationCategory: 'TravelApplication',
    demoUrl: 'https://route2gpx.rsmb.tv',
    sourceUrl: 'https://github.com/robert-bryson/route2gpx',
    previewImage: '/images/route2gpx/route-planning.webp',
    year: 2024,
    lastUpdated: '2026-04-07',
    changelog: [
      {
        date: '2026-04',
        notes: [
          'Added GPX, KML, FIT, TCX, and GeoJSON imports, including compressed files',
          'Added drag-and-drop file import and multi-file selection',
          'Added Fog of World export visualization',
          'Added route elevation data and download filename previews',
          'Added ZIP downloads for multiple routes',
        ],
      },
    ],
  },
];

export const featuredProjects = projects.filter(p => p.featured);

/**
 * Returns the project's `lastUpdated` date formatted as "Mon YYYY",
 * or falls back to the `year` field as a string.
 */
export function formatProjectDate(project: Project): string {
  return formatMonthYear(project.lastUpdated || String(project.year));
}
