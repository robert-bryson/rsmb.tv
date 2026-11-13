import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { projects } from '../content/projects';

function renderLayout(route = '/') {
    return render(
        <MemoryRouter initialEntries={[route]}>
            <Layout>
                <p>Page content</p>
            </Layout>
        </MemoryRouter>
    );
}

describe('Layout', () => {
    afterEach(() => {
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('renders the site navigation and keeps Projects clickable', () => {
        renderLayout();

        expect(screen.getByRole('link', { name: 'rsmb' })).toHaveAttribute('href', '/');
        expect(screen.getByRole('link', { name: 'Posts' })).toHaveAttribute('href', '/posts');
        expect(screen.queryByRole('link', { name: 'Blog' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Trips' })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects');
        expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
        expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
        expect(screen.getByText('Page content')).toBeInTheDocument();
    });

    it('opens a project disclosure and dismisses it without losing keyboard focus', () => {
        renderLayout('/projects');
        const toggle = screen.getByRole('button', { name: 'Project pages' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('list', { name: 'Project pages' })).not.toBeInTheDocument();
        fireEvent.click(toggle);
        const projectPages = screen.getByRole('list', { name: 'Project pages' });
        expect(toggle).toHaveAttribute('aria-controls', projectPages.parentElement!.id);
        for (const project of projects) {
            expect(within(projectPages).getByRole('link', { name: project.title })).toHaveAttribute(
                'href',
                `/projects/${project.slug}`
            );
        }
        act(() => within(projectPages).getByRole('link', { name: projects[0].title }).focus());
        fireEvent.keyDown(projectPages, { key: 'Escape' });
        expect(toggle).toHaveFocus();
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('list', { name: 'Project pages' })).not.toBeInTheDocument();
    });

    it('marks nested project routes active in both nav levels', () => {
        renderLayout('/projects/temperature-records/trends');

        expect(screen.getByRole('link', { name: 'Projects' })).toHaveClass('text-violet-400');
        expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'location');
        fireEvent.click(screen.getByRole('button', { name: 'Project pages' }));
        expect(screen.getByRole('link', { name: 'U.S. Temperature Records' })).toHaveClass('text-violet-300');
        expect(screen.getByRole('link', { name: 'U.S. Temperature Records' })).toHaveAttribute('aria-current', 'location');
    });

    it('dismisses a hover disclosure with Escape while focus remains outside it', () => {
        renderLayout();
        const posts = screen.getByRole('link', { name: 'Posts' });
        posts.focus();
        fireEvent.pointerEnter(screen.getByRole('link', { name: 'Projects' }).closest('li')!);
        const toggle = screen.getByRole('button', { name: 'Project pages' });
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        fireEvent.keyDown(posts, { key: 'Escape' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(posts).toHaveFocus();
    });

    it.each(['/posts', '/blog/a-post', '/trips/a-trip'])('marks Posts active for %s', (route) => {
        renderLayout(route);

        expect(screen.getByRole('link', { name: 'Posts' })).toHaveClass('text-violet-400');
    });

    it('reveals the header when scrolling up and provides a scroll-to-top control', async () => {
        const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
        renderLayout('/blog');
        const header = screen.getByRole('banner');

        act(() => {
            Object.defineProperty(window, 'scrollY', { configurable: true, value: 600 });
            fireEvent.scroll(window);
        });

        await waitFor(() => expect(header).toHaveClass('-translate-y-full'));
        expect(header.parentElement).toHaveAttribute('data-header-visible', 'false');
        const scrollTopButton = screen.getByRole('button', { name: 'Scroll to top' });

        act(() => {
            Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 });
            fireEvent.scroll(window);
        });

        await waitFor(() => expect(header).toHaveClass('translate-y-0'));
        expect(header.parentElement).toHaveAttribute('data-header-visible', 'true');
        fireEvent.click(scrollTopButton);
        expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    it('measures the navigation for sticky content and releases its resize observer', () => {
        let onResize: ResizeObserverCallback = () => undefined;
        const observe = vi.fn();
        const disconnect = vi.fn();
        vi.stubGlobal('ResizeObserver', class {
            constructor(callback: ResizeObserverCallback) { onResize = callback; }
            observe = observe;
            disconnect = disconnect;
        });
        const bounds = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
            .mockReturnValue({ height: 61 } as DOMRect);
        const { unmount } = renderLayout('/trips/coast');
        const header = screen.getByRole('banner');
        const layout = header.parentElement!;
        expect(observe).toHaveBeenCalledWith(header);
        expect(layout.style.getPropertyValue('--site-header-height')).toBe('61px');
        bounds.mockReturnValue({ height: 90 } as DOMRect);
        act(() => onResize([], {} as ResizeObserver));
        expect(layout.style.getPropertyValue('--site-header-height')).toBe('90px');
        unmount();
        expect(disconnect).toHaveBeenCalledOnce();
    });

    it('keeps focused header navigation visible during downward scrolling', async () => {
        renderLayout('/posts');
        const header = screen.getByRole('banner');
        act(() => {
            Object.defineProperty(window, 'scrollY', { configurable: true, value: 600 });
            fireEvent.scroll(window);
        });
        await waitFor(() => expect(header).toHaveClass('-translate-y-full'));
        act(() => screen.getByRole('link', { name: 'rsmb' }).focus());
        expect(header).toHaveClass('translate-y-0');
        act(() => {
            Object.defineProperty(window, 'scrollY', { configurable: true, value: 700 });
            fireEvent.scroll(window);
        });
        await waitFor(() => expect(screen.getByRole('button', { name: 'Scroll to top' })).toBeInTheDocument());
        expect(header).toHaveClass('translate-y-0');
    });

    it('omits header and footer chrome for fullscreen map pages', () => {
        renderLayout('/projects/flights/map');

        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Projects' })).not.toBeInTheDocument();
        expect(screen.getByText('Page content')).toBeInTheDocument();
    });
});
