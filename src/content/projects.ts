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
    slug: 'flights',
    title: 'Flight Tracker',
    description: 'An interactive 3D globe visualization of flights I\'ve taken around the world. Filter by year, see route frequencies, and explore travel statistics.',
    tech: ['React', 'Three.js', 'WebGL', 'GeoJSON'],
    featured: true,
    demoUrl: '/projects/flights',
    year: 2025,
  },
  {
    slug: 'route2gpx',
    title: 'route2gpx',
    description: 'Convert Google Routes into GPX files for GPS devices and bike computers. A privacy-focused web app that runs entirely in your browser—your routes never touch a server.',
    tech: ['JavaScript', 'Leaflet', 'Google Routes API'],
    featured: true,
    demoUrl: 'https://robert-bryson.github.io/route2gpx/',
    sourceUrl: 'https://github.com/robert-bryson/route2gpx',
    year: 2024,
  },
];

export const featuredProjects = projects.filter(p => p.featured);
