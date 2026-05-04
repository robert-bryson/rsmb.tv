import { describe, it, expect } from 'vitest';
import { projects, featuredProjects } from '../content/projects';

const committedWebpImages = import.meta.glob('/public/images/**/*.webp', {
    eager: true,
    import: 'default',
    query: '?url',
});

describe('projects data', () => {
    it('has at least one project', () => {
        expect(projects.length).toBeGreaterThan(0);
    });

    it('each project has required fields', () => {
        for (const p of projects) {
            expect(typeof p.slug).toBe('string');
            expect(p.slug.length).toBeGreaterThan(0);
            expect(typeof p.title).toBe('string');
            expect(typeof p.description).toBe('string');
            expect(Array.isArray(p.tech)).toBe(true);
            expect(p.tech.length).toBeGreaterThan(0);
            expect(typeof p.year).toBe('number');
        }
    });

    it('slugs are unique', () => {
        const slugs = projects.map(p => p.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('demoUrls are valid URLs or internal paths', () => {
        for (const p of projects) {
            if (p.demoUrl) {
                expect(
                    p.demoUrl.startsWith('/') || p.demoUrl.startsWith('https://')
                ).toBe(true);
            }
        }
    });

    it('sourceUrls are GitHub URLs', () => {
        for (const p of projects) {
            if (p.sourceUrl) {
                expect(p.sourceUrl).toMatch(/^https:\/\/github\.com\//);
            }
        }
    });

    it('featuredProjects is a subset of projects', () => {
        expect(featuredProjects.length).toBeGreaterThan(0);
        expect(featuredProjects.length).toBeLessThanOrEqual(projects.length);
        for (const fp of featuredProjects) {
            expect(projects).toContain(fp);
        }
    });

    it('preview images are optimized committed assets', () => {
        for (const p of projects) {
            if (!p.previewImage) {
                continue;
            }

            expect(p.previewImage).toMatch(/^\/images\/.+\.webp$/);
            expect(committedWebpImages).toHaveProperty(`/public${p.previewImage}`);
        }
    });

    it('uses a composed Anki Artisan preview instead of a portrait screenshot', () => {
        expect(projects.find(p => p.slug === 'anki-artisan')?.previewImage).toBe('/images/anki-artisan/anki-artisan-preview.webp');
    });
});
