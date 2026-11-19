import { formatMonthYear } from '../utils/formatDate.ts';

export const projectCategories = {
  maps: 'Maps & data',
  apps: 'Web apps',
  tools: 'Command line',
} as const;

export type ProjectCategory = keyof typeof projectCategories;

export interface ChangelogEntry {
  /** Feature month (YYYY-MM), in descending order within each project. */
  date: string;
  notes: string[];
}

export interface Project {
  slug: string;
  title: string;
  description: string;
  category: ProjectCategory;
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
    slug: 'ski-status',
    title: 'ski-status',
    category: 'maps',
    description: 'Compare North American ski areas and worldwide Ikon and Epic destinations. Filter the map and table by location, pass, and night skiing, and open official mountain reports.',
    tech: ['React', 'TypeScript', 'MapLibre GL', 'GeoJSON'],
    applicationCategory: 'TravelApplication',
    demoUrl: '/projects/ski-status/map',
    year: 2026,
    lastUpdated: '2026-11-19',
    changelog: [{ date: '2026-11', notes: [
      'Expanded the ski area catalog to 197 areas',
      'Added Map, Split, and Table views, resort dot colors, and terrain relief',
      'Added an In map view filter for the comparison table',
      'Added larger pass icons and compact multi-pass badges',
      'Added worldwide Ikon destinations and country filters',
      'Added worldwide Epic destinations, including individual partner resorts',
    ] }],
  },
  {
    slug: 'pins-of-inaccessibility',
    title: 'Pins of Inaccessibility',
    category: 'maps',
    description: 'Explore country, province, and U.S. county poles on a 3D globe. Compare boundary distances, move between geographic levels, and check available terrain and nearby-place details.',
    summary: 'Explore global interior pins, compare boundary distances, and follow geographic levels back to the world.',
    tech: ['React', 'TypeScript', 'MapLibre GL', 'Python', 'GeoJSON'],
    applicationCategory: 'EducationalApplication',
    demoUrl: '/projects/pins-of-inaccessibility/map',
    previewImage: '/images/pins-of-inaccessibility/overview.webp',
    sourceUrl: 'https://github.com/robert-bryson/rsmb.tv/tree/main/projects/pins-of-inaccessibility',
    year: 2026,
    lastUpdated: '2026-11-13',
    changelog: [{ date: '2026-11', notes: [
      'Docked map layer controls below the canvas so settings do not cover the map',
      'Added parent navigation, location trails, shared state views, and browser history',
      'Added muted, selectable context pins and peer-circle outlines',
      'Added terrain elevation, nearby-place details, and external map links for selected pins',
      'Improved touch targets and map layout on narrow and short screens',
      'Added global country and province pins, a country selector, and lazy country-specific data',
      'Added radius spokes with distance labels that appear as you zoom in',
      'Added the national U.S. pole with internal state borders dissolved',
      'Added state, territory, and county pins calculated from Census administrative boundaries',
      'Added geodesic radius circles, county zoom controls, search, and radius rankings',
    ] }],
  },
  {
    slug: 'adv-atlas',
    title: 'ADV Atlas',
    category: 'maps',
    description: 'Explore motorcycle journeys on a shared route map. Filter by year, riding days, distance, or location, compare trips in cards or a sortable table, and read ride reports with photographs and day maps.',
    summary: 'Filter motorcycle journeys, compare trip facts, and explore ride reports with photographs and day maps.',
    tech: ['React', 'TypeScript', 'MapLibre GL', 'GeoJSON'],
    applicationCategory: 'TravelApplication',
    demoUrl: '/projects/adv-atlas/map',
    previewImage: '/images/adv-atlas/adv-atlas.webp',
    year: 2026,
    lastUpdated: '2026-11-13',
    changelog: [
      {
        date: '2026-11',
        notes: [
          'Added sticky chapter headings that keep the current day visible while reading',
          'Added inline panoramas to the trip report photo viewer',
          'Added draggable trip panels and customizable columns in the comparison table',
          'Added presets for year, riding days, and distance, plus clickable locations that filter and frame the map',
          'Added start and end pins and markers between recorded riding days',
        ],
      },
      {
        date: '2026-10',
        notes: [
          'Launched a shared route map connecting motorcycle journeys, photographs, and ride reports',
          'Added trip filters, sorting, detailed cards, and a comparison table',
          'Added shareable map views with trip selection, filters, panel settings, and camera position',
          'Added map and trip-list restoration when returning from a report or reloading the page',
        ],
      },
    ],
  },
  {
    slug: 'through-routes',
    title: 'Through Routes',
    category: 'maps',
    description: 'Explore motorcycle roads scored by curvature and ride quality. Inspect elevation and hairpins, find scenic stops, build routes with undo and redo, or generate loops and export GPX.',
    summary: 'Find motorcycle roads and loops, inspect road profiles, and build routes with GPX export.',
    tech: ['Python', 'NumPy', 'FastAPI', 'TypeScript', 'MapLibre GL', 'Docker'],
    applicationCategory: 'TravelApplication',
    featured: true,
    demoUrl: 'https://through-routes.rsmb.tv/',
    sourceUrl: 'https://github.com/robert-bryson/through-routes',
    previewImage: '/images/through-routes/through-routes-curviness-map.webp',
    year: 2026,
    lastUpdated: '2026-11-14',
    changelog: [
      {
        date: '2026-11',
        notes: [
          'Added undo and redo for road additions, removals, reordering, and clearing the route builder',
          'Added expanded road profiles with curvature, elevation, grade, and scored hairpin inspection',
          'Added independent scenic-stop and amenity layers alongside fuel stations and gates',
          'Added a shared basemap and layer menu, independent unit preferences, and persistent selected-road highlighting',
        ],
      },
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
    category: 'maps',
    description: 'Explore my flight history on a 3D globe. Filter by year, airport, airline, or country, compare routes and recorded flight times, and share the current view.',
    summary: 'Explore flight routes, recorded travel time, and airport and country statistics on a 3D globe.',
    tech: ['React', 'Three.js', 'WebGL', 'GeoJSON'],
    applicationCategory: 'TravelApplication',
    featured: true,
    demoUrl: '/projects/flights/map',
    previewImage: '/images/flights/flight-globe.webp',
    year: 2025,
    lastUpdated: '2026-11-10',
    changelog: [
      {
        date: '2026-11',
        notes: [
          'Added a saved setting to enable or disable character keyboard shortcuts from the help dialog',
          'Added recorded flight durations, hour totals, and actual, scheduled, and estimated coverage',
          'Added authenticated CARTO globe tiles',
        ],
      },
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
    category: 'tools',
    description: 'Build Anki decks from iNaturalist observations, eBird regions, CSV files, and Wikipedia tables. Generate photo, sound, nomenclature, and taxonomy cards, preview a build, and export only changed cards.',
    summary: 'Build wildlife flashcards from observations, bird checklists, CSV files, and Wikipedia tables.',
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
    category: 'tools',
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
    category: 'tools',
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
    category: 'apps',
    description: 'Track reading, explore award lists, and compare reading patterns across five analytics views. Browse the public reading demo, organize personal lists, and enrich book and author metadata with administrator controls to protect corrected fields.',
    summary: 'Track reading, explore award lists and reading analytics, or try the public reading demo.',
    tech: ['Next.js', 'TypeScript', 'Prisma', 'PostgreSQL', 'Tailwind CSS', 'Docker'],
    applicationCategory: 'LifestyleApplication',
    featured: true,
    demoUrl: 'https://bookend.rsmb.tv',
    sourceUrl: 'https://github.com/robert-bryson/bookend',
    previewImage: '/images/bookend/bookend-home.webp',
    year: 2026,
    lastUpdated: '2026-11-15',
    changelog: [
      {
        date: '2026-11',
        notes: [
          'Added administrator controls to protect corrected book and author fields from enrichment and undo',
          'Added full book and author catalog links that retain the global search query',
          'Added bulk personal-list assignment with explicit handling of mixed book memberships',
          'Rebuilt reading profiles with five analytics views, period comparisons, reading-history links, and exports',
          'Added a public reading demo with a dashboard, reading history, lists, and profile analytics',
        ],
      },
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
    category: 'maps',
    description: 'Explore recent station records with state, scope, and margin filters and visible data freshness and coverage. Compare observed county extremes, certified state extremes, and the ages of standing records.',
    tech: ['React', 'MapLibre GL', 'NOAA ACIS', 'GeoJSON'],
    applicationCategory: 'WeatherApplication',
    demoUrl: '/projects/temperature-records/map',
    previewImage: '/images/temperature-records/records-daily.webp',
    year: 2025,
    lastUpdated: '2026-11-03',
    changelog: [
      {
        date: '2026-11',
        notes: [
          'Added snapshot freshness and state-coverage indicators for published temperature observations',
        ],
      },
      {
        date: '2026-09',
        notes: [
          'Added state, daily or monthly scope, and minimum record-margin filters for recent station records',
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
    category: 'maps',
    description: 'Explore recorded tornado county segments from NOAA/NCEI StormEvents. Filter by year, intensity, region, or state, inspect reported paths, and compare density and historical trends.',
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
    category: 'tools',
    description: 'A live terminal monitoring dashboard for AWS infrastructure, GitHub CI builds, and site health. Renders health checks, CloudWatch alarms, build statuses, cost forecasts, and incident logs side-by-side in the terminal using Ink.',
    summary: 'Monitor site health, AWS resources, Amplify deployments, and named GitHub Actions workflows.',
    tech: ['TypeScript', 'React (Ink)', 'AWS SDK v3', 'CloudWatch', 'Route53', 'GitHub API'],
    applicationCategory: 'DeveloperApplication',
    year: 2025,
    lastUpdated: '2026-05-28',
    previewImage: '/images/status-dashboard/status-dashboard-calm.webp',
    changelog: [
      {
        date: '2026-05',
        notes: [
          'Added visible status for configured workflows before their first run',
        ],
      },
      {
        date: '2026-04',
        notes: [
          'Added separate Amplify and GitHub Actions sections with named workflow status and links',
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
    category: 'maps',
    description: 'Plan routes or import GPS tracks, then export GPX, KML, GeoJSON, TCX, or CSV. File imports and conversion run locally in your browser.',
    tech: ['JavaScript', 'Leaflet', 'Google Routes API', 'Python'],
    applicationCategory: 'TravelApplication',
    demoUrl: 'https://route2gpx.rsmb.tv',
    sourceUrl: 'https://github.com/robert-bryson/route2gpx',
    previewImage: '/images/route2gpx/route-planning-v1-1.webp',
    year: 2024,
    lastUpdated: '2026-11-03',
    changelog: [
      {
        date: '2026-11',
        notes: [
          'Choose GPX, KML, GeoJSON, TCX, or CSV from one download popup, with filename previews and track-data details',
          'Export TCX courses with an explicit choice to generate estimated times when recorded times are incomplete',
          'Export CSV rows with segment numbers, coordinates, elevations, and recorded times for spreadsheet analysis',
          'Reuse saved routes in the planner and keep named, numbered planner points on the map',
        ],
      },
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
export const homeProjects = featuredProjects.slice(0, 3);
// Shared with the initial HTML preload so the browser requests the same variant.
export const HOME_PROJECT_IMAGE_SIZES = '(min-width: 768px) 720px, calc(100vw - 3rem)';

/**
 * Returns the project's `lastUpdated` date formatted as "Mon YYYY",
 * or falls back to the `year` field as a string.
 */
export function formatProjectDate(project: Project): string {
  return formatMonthYear(project.lastUpdated || String(project.year));
}
