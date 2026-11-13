import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PinsOfInaccessibilityAbout from '../pages/PinsOfInaccessibilityAbout';
import { trackAnalyticsEvent } from '../utils/analytics';
import { renderWithRouter } from './helpers/router';

vi.mock('../utils/analytics', () => ({ trackAnalyticsEvent: vi.fn() }));
beforeEach(() => vi.mocked(trackAnalyticsEvent).mockClear());

describe('Pins project source links', () => {
    it('keeps source data in the article and preserves the primary project actions', () => {
        renderWithRouter(<PinsOfInaccessibilityAbout />, { route: '/projects/pins-of-inaccessibility' });
        const action = screen.getByRole('link', { name: 'Open interactive map →' });
        expect(action).toHaveAttribute('href', '/projects/pins-of-inaccessibility/map');
        expect(action.parentElement?.querySelectorAll('a')).toHaveLength(2);
        expect(screen.getByRole('link', { name: 'Source on GitHub →' })).toBeInTheDocument();
        const sources = screen.getByRole('heading', { name: 'Sources', level: 2 });
        for (const name of ['2025 Census TIGER/Line data', 'Natural Earth 5.1.1']) {
            const link = screen.getByRole('link', { name });
            expect(sources.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
            expect(action.parentElement?.contains(link)).toBe(false);
        }
    });

    it.each([
        ['2025 Census TIGER/Line data', 'https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html'],
        ['Natural Earth 5.1.1', 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/'],
    ])('preserves external isolation and bounded analytics for %s', (name, href) => {
        renderWithRouter(<PinsOfInaccessibilityAbout />, { route: '/projects/pins-of-inaccessibility' });
        const link = screen.getByRole('link', { name });
        expect(link).toHaveAttribute('href', href);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link.getAttribute('rel')?.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
        fireEvent.click(link);
        expect(trackAnalyticsEvent).toHaveBeenCalledExactlyOnceWith('project-link-click', {
            project: 'pins-of-inaccessibility', destination: 'data', placement: 'about',
        });
    });
});
