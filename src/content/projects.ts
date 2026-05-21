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
  },
  {
    slug: 'aborg',
    title: 'aborg',
    description: 'A CLI tool to scan, organize, and manage audiobook file collections. Outputs an Audiobookshelf-compatible directory structure with smart filename parsing, metadata extraction, and Libby/OverDrive integration.',
    tech: ['Python', 'Click', 'Mutagen', 'Rich', 'YAML'],
    applicationCategory: 'UtilitiesApplication',
    sourceUrl: 'https://github.com/robert-bryson/aborg',
    year: 2026,
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
  },
];

export const featuredProjects = projects.filter(p => p.featured);
