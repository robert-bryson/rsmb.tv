import { describe, expect, it } from 'vitest';
import { createProjectsUrl, filterProjects, getProjectCategory } from '../content/projectFilters';
import { projectCategories, projects, type Project } from '../content/projects';

const examples: Project[] = [
    { slug: 'cafe-routes', title: 'Café Routes', description: 'Explore winding roads.', summary: 'Discover scenic journeys.', category: 'maps', tech: ['Python', 'MapLibre GL'], applicationCategory: 'TravelApplication', year: 2026 },
    { slug: 'library', title: 'Library', description: 'Organize books and reading lists.', category: 'apps', tech: ['TypeScript'], applicationCategory: 'LifestyleApplication', year: 2025 },
    { slug: 'archive', title: 'Archive', description: 'Download podcasts.', category: 'tools', tech: ['Python'], applicationCategory: 'UtilitiesApplication', year: 2024 },
];

describe('project discovery', () => {
    it('keeps the curated order for empty and punctuation-only searches', () => {
        expect(filterProjects(examples, { query: '', category: 'all' })).toEqual(examples);
        expect(filterProjects(examples, { query: '   !!!  ', category: 'all' })).toEqual(examples);
    });

    it('matches every keyword across names, descriptions, summaries, and technologies', () => {
        expect(filterProjects(examples, { query: 'PYTHON café scenic', category: 'all' })).toEqual([examples[0]]);
        expect(filterProjects(examples, { query: 'books typescript', category: 'all' })).toEqual([examples[1]]);
        expect(filterProjects(examples, { query: 'python books', category: 'all' })).toEqual([]);
    });

    it('normalizes accents and punctuation and supports category names', () => {
        expect(filterProjects(examples, { query: 'cafe-routes maplibre.gl', category: 'all' })).toEqual([examples[0]]);
        expect(filterProjects(examples, { query: 'command line', category: 'all' })).toEqual([examples[2]]);
    });

    it('combines category and search without changing the original list', () => {
        const before = structuredClone(examples);
        expect(filterProjects(examples, { query: 'python', category: 'tools' })).toEqual([examples[2]]);
        expect(filterProjects(examples, { query: 'python', category: 'apps' })).toEqual([]);
        expect(filterProjects(Object.freeze([...examples]), { category: 'maps' })).toEqual([examples[0]]);
        expect(examples).toEqual(before);
    });

    it.each([null, '', 'missing', 'MAPS', 'constructor', '__proto__'])('treats unknown category %s as all projects', value => {
        expect(getProjectCategory(value)).toBe('all');
    });

    it('accepts the published categories and assigns every project to one', () => {
        for (const category of Object.keys(projectCategories)) {
            expect(getProjectCategory(category)).toBe(category);
            expect(projects.some(project => project.category === category)).toBe(true);
        }
        for (const project of projects) expect(Object.hasOwn(projectCategories, project.category)).toBe(true);
    });

    it('encodes shareable filters and omits defaults', () => {
        expect(createProjectsUrl()).toBe('/projects');
        const url = new URL(createProjectsUrl({ category: 'maps', query: 'Café & roads?' }), 'https://rsmb.tv');
        expect(url.searchParams.get('category')).toBe('maps');
        expect(url.searchParams.get('q')).toBe('Café & roads?');
        expect(new URL(createProjectsUrl({ query: 'python' }), url).searchParams.has('category')).toBe(false);
        expect(createProjectsUrl({ category: 'tools' })).toBe('/projects?category=tools');
    });

    it('keeps reserved characters and script-like text inside one encoded query', () => {
        const query = 'Québec &category=apps#<script>alert(1)</script> + maps';
        const url = new URL(createProjectsUrl({ category: 'maps', query }), 'https://rsmb.tv');
        expect(url.origin).toBe('https://rsmb.tv');
        expect(url.pathname).toBe('/projects');
        expect(url.hash).toBe('');
        expect(url.searchParams.getAll('category')).toEqual(['maps']);
        expect(url.searchParams.getAll('q')).toEqual([query]);
    });
});
