export interface Project {
  slug: string;
  title: string;
  description: string;
  tech: string[];
  featured?: boolean;
  demoUrl?: string;
  sourceUrl?: string;
  year: number;
}

export const projects: Project[] = [
  {
    slug: 'through-routes',
    title: 'Through Routes',
    description: 'Find scenic, twisty motorcycle loop routes on rural roads. Processes OpenStreetMap data to build a loop-friendly road graph, scores roads by curviness and elevation change, and generates ranked circular routes from any start point.',
    tech: ['Python', 'NumPy', 'FastAPI', 'TypeScript', 'MapLibre GL', 'Docker'],
    featured: true,
    demoUrl: 'https://through-routes.rsmb.tv/',
    sourceUrl: 'https://github.com/robert-bryson/through-routes',
    year: 2026,
  },
  {
    slug: 'flights',
    title: 'Flight Tracker',
    description: 'An interactive 3D globe visualization of flights I\'ve taken around the world. Filter by year, see route frequencies, and explore travel statistics.',
    tech: ['React', 'Three.js', 'WebGL', 'GeoJSON'],
    featured: true,
    demoUrl: '/projects/flights',
    year: 2025,
  },
  {
    slug: 'anki-artisan',
    title: 'Anki Artisan',
    description: 'Craft Anki flashcard decks from iNaturalist observations and eBird region data. Automatically fetches species photos, audio, and taxonomy to generate visual ID, nomenclature, sound ID, and confusion species cards.',
    tech: ['Python', 'Click', 'eBird API', 'iNaturalist API', 'SQLite'],
    featured: true,
    demoUrl: '/projects/anki-artisan',
    sourceUrl: 'https://github.com/robert-bryson/anki-artisan',
    year: 2026,
  },
  {
    slug: 'bookend',
    title: 'Bookend',
    description: 'A personal book-tracking app to log reads, organize books into lists, and explore reading stats. Integrates with Google Books, Open Library, and Wikidata for enrichment—covers, descriptions, author links, and more.',
    tech: ['Next.js', 'TypeScript', 'Prisma', 'PostgreSQL', 'Tailwind CSS', 'Docker'],
    featured: true,
    sourceUrl: 'https://github.com/robert-bryson/bookend',
    year: 2026,
  },
  {
    slug: 'route2gpx',
    title: 'route2gpx',
    description: 'Convert Google Routes into GPX files for GPS devices and bike computers. A privacy-focused web app that runs entirely in your browser—your routes never touch a server.',
    tech: ['JavaScript', 'Leaflet', 'Google Routes API'],
    featured: true,
    demoUrl: 'https://route2gpx.rsmb.tv',
    sourceUrl: 'https://github.com/robert-bryson/route2gpx',
    year: 2024,
  },
];

export const featuredProjects = projects.filter(p => p.featured);
