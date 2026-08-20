import { describe, it, expect } from 'vitest';
import { projects, featuredProjects, formatProjectDate } from '../content/projects';
import type { Project } from '../content/projects';

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
            expect(typeof p.applicationCategory).toBe('string');
            expect(p.applicationCategory).toMatch(/Application$/);
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

    it('curates four flagship projects for the home page', () => {
        expect(featuredProjects.map(project => project.slug)).toEqual([
            'through-routes',
            'flights',
            'anki-artisan',
            'bookend',
        ]);
        for (const fp of featuredProjects) {
            expect(projects).toContain(fp);
            expect(fp.summary).toBeTruthy();
            expect(fp.previewImage).toBeTruthy();
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

function makeProject(overrides: Partial<Project> = {}): Project {
    return {
        slug: 'test',
        title: 'Test',
        description: 'desc',
        tech: ['TS'],
        applicationCategory: 'UtilitiesApplication',
        year: 2024,
        ...overrides,
    };
}

describe('formatProjectDate', () => {
    it('formats a full ISO lastUpdated date as "Mon YYYY"', () => {
        const p = makeProject({ lastUpdated: '2026-05-22' });
        expect(formatProjectDate(p)).toBe('May 2026');
    });

    it('formats a year-month lastUpdated date as "Mon YYYY"', () => {
        const p = makeProject({ lastUpdated: '2026-01' });
        expect(formatProjectDate(p)).toBe('Jan 2026');
    });

    it('falls back to year string when lastUpdated is absent', () => {
        const p = makeProject({ year: 2025 });
        expect(formatProjectDate(p)).toBe('2025');
    });

    it('falls back to year string when lastUpdated is year-only', () => {
        const p = makeProject({ lastUpdated: '2026' });
        expect(formatProjectDate(p)).toBe('2026');
    });

    it('each project with lastUpdated produces a non-empty formatted date', () => {
        for (const p of projects) {
            if (p.lastUpdated) {
                expect(formatProjectDate(p).length).toBeGreaterThan(0);
            }
        }
    });
});

describe('changelog data', () => {
    it('provides a changelog and exact last-updated date for every project', () => {
        for (const p of projects) {
            expect(p.lastUpdated, `${p.slug} lastUpdated`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(p.changelog?.length, `${p.slug} changelog`).toBeGreaterThan(0);
            expect(p.changelog?.[0]?.date, `${p.slug} latest changelog month`).toBe(
                p.lastUpdated?.slice(0, 7),
            );
        }
    });

    it('changelog entries use valid dates and unique, non-empty notes', () => {
        for (const p of projects) {
            if (!p.changelog) continue;
            expect(new Set(p.changelog.map(entry => entry.date)).size, `${p.slug} changelog dates`).toBe(
                p.changelog.length,
            );

            for (const entry of p.changelog) {
                expect(entry.date, `${p.slug} changelog date`).toMatch(/^\d{4}-\d{2}(?:-\d{2})?$/);
                expect(entry.notes.length).toBeGreaterThan(0);
                expect(new Set(entry.notes).size, `${p.slug} ${entry.date} notes`).toBe(entry.notes.length);
                for (const note of entry.notes) {
                    expect(note, `${p.slug} ${entry.date} note`).toBe(note.trim());
                    expect(note.length, `${p.slug} ${entry.date} note`).toBeGreaterThan(0);
                }
            }
        }
    });

    it('changelog dates are in descending order per project', () => {
        for (const p of projects) {
            if (!p.changelog || p.changelog.length < 2) continue;
            const dates = p.changelog.map(e => e.date);
            const sorted = [...dates].sort((a, b) => b.localeCompare(a));
            expect(dates).toEqual(sorted);
        }
    });
});
