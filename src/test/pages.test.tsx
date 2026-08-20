import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Home } from '../pages/Home';
import { About } from '../pages/About';
import { Blog } from '../pages/Blog';
import { Projects } from '../pages/Projects';
import { NotFound } from '../pages/NotFound';
import { featuredProjects, projects } from '../content/projects';
import { getAllPosts } from '../content/posts';
import { getJsonLdByType } from './helpers/jsonLd';
import { renderWithRouter } from './helpers/router';

describe('Home page', () => {
    it('renders greeting', () => {
        renderWithRouter(<Home />);
        expect(screen.getByText(/Hi, I'm Robby/i)).toBeInTheDocument();
    });

    it('renders projects section', () => {
        renderWithRouter(<Home />);
        expect(screen.getByRole('heading', { level: 2, name: 'Projects' })).toBeInTheDocument();
    });

    it('renders projects index link', () => {
        renderWithRouter(<Home />);
        expect(screen.getAllByRole('link', { name: /View all/i }).some((link) => link.getAttribute('href') === '/projects')).toBe(true);
        const projectsLink = screen.getByRole('link', { name: 'See all projects →' });
        expect(projectsLink).toHaveAttribute('href', '/projects');
        expect(projectsLink.closest('section')).toContainElement(
            screen.getByRole('heading', { level: 2, name: 'Projects' }),
        );
    });

    it('renders only the curated projects with concise summaries', () => {
        renderWithRouter(<Home />);

        for (const project of featuredProjects) {
            expect(screen.getByRole('link', { name: new RegExp(project.title, 'i') })).toBeInTheDocument();
            expect(project.summary).toBeTruthy();
            expect(screen.getByText(project.summary ?? project.description)).toBeInTheDocument();
        }
        expect(screen.queryByRole('link', { name: /Tornado Tracks/i })).not.toBeInTheDocument();
    });

    it('adds WebSite JSON-LD with shared author', () => {
        renderWithRouter(<Home />);
        const jsonLd = getJsonLdByType('WebSite');
        expect(jsonLd).toMatchObject({
            name: 'rsmb',
            url: 'https://rsmb.tv',
            author: { '@type': 'Person', name: 'Robby Bryson', url: 'https://rsmb.tv' },
        });
    });
});

describe('About page', () => {
    it('renders about heading', () => {
        renderWithRouter(<About />, { route: '/about' });
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('adds ProfilePage JSON-LD', () => {
        renderWithRouter(<About />, { route: '/about' });
        const jsonLd = getJsonLdByType('ProfilePage');

        expect(jsonLd).toMatchObject({
            name: 'About Robby Bryson',
            url: 'https://rsmb.tv/about',
            mainEntity: { '@type': 'Person', name: 'Robby Bryson' },
        });
    });
});

describe('Projects page', () => {
    it('renders projects heading', () => {
        renderWithRouter(<Projects />, { route: '/projects' });
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('adds CollectionPage JSON-LD for all projects', () => {
        renderWithRouter(<Projects />, { route: '/projects' });
        const jsonLd = getJsonLdByType<{
            mainEntity: { itemListElement: Array<{ position: number; item: { url: string } }> };
        }>('CollectionPage');

        expect(jsonLd).toMatchObject({
            name: 'Projects',
            url: 'https://rsmb.tv/projects',
        });
        const items = jsonLd!.mainEntity.itemListElement;
        expect(items).toHaveLength(projects.length);
        items.forEach((item, index) => {
            expect(item.position).toBe(index + 1);
            expect(item.item.url).toBe(`https://rsmb.tv/projects/${projects[index].slug}`);
        });
    });
});

describe('Blog page', () => {
    it('renders blog heading', () => {
        renderWithRouter(<Blog />, { route: '/blog' });
        expect(screen.getByRole('heading', { level: 1, name: /Blog/i })).toBeInTheDocument();
    });

    it('adds Blog JSON-LD with author and image on every post', () => {
        renderWithRouter(<Blog />, { route: '/blog' });
        const jsonLd = getJsonLdByType<{
            blogPost: Array<{
                headline: string;
                url: string;
                image: string;
                author: { name: string };
            }>;
        }>('Blog');

        expect(jsonLd).toMatchObject({
            name: 'rsmb Blog',
            url: 'https://rsmb.tv/blog',
        });

        const posts = getAllPosts();
        expect(jsonLd!.blogPost).toHaveLength(posts.length);
        jsonLd!.blogPost.forEach((entry, index) => {
            expect(entry.headline).toBe(posts[index].title);
            expect(entry.url).toBe(`https://rsmb.tv/blog/${posts[index].slug}`);
            expect(entry.image).toBe(`https://rsmb.tv/og/blog/${posts[index].slug}.svg`);
            expect(entry.author.name).toBe('Robby Bryson');
        });
    });
});

describe('NotFound page', () => {
    it('renders 404 message', () => {
        renderWithRouter(<NotFound />, { route: '/nonexistent' });
        expect(screen.getByText('404')).toBeInTheDocument();
        expect(screen.getByText(/doesn't exist/i)).toBeInTheDocument();
    });

    it('renders link back to home', () => {
        renderWithRouter(<NotFound />, { route: '/nonexistent' });
        expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
    });
});
