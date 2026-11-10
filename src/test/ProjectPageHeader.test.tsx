import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProjectPageHeader } from '../components/ProjectPageHeader';
import { trackAnalyticsEvent } from '../utils/analytics';
import { renderWithRouter } from './helpers/router';

vi.mock('../utils/analytics', () => ({ trackAnalyticsEvent: vi.fn() }));

describe('project header actions', () => {
    it('uses router navigation for internal actions and preserves external link isolation', () => {
        renderWithRouter(
            <Routes>
                <Route path="/projects/example" element={(
                    <ProjectPageHeader
                        title="Example"
                        stack="React"
                        description="Example project."
                        actions={[
                            { label: 'Open map', href: '/projects/example/map', variant: 'primary' },
                            { label: 'Source', href: 'https://github.com/example/source', external: true },
                            { label: 'Data', href: 'https://example.org/data', external: true, analyticsDestination: 'data' },
                        ]}
                    />
                )} />
                <Route path="/projects/example/map" element={<h1>Example map</h1>} />
            </Routes>,
            { route: '/projects/example' },
        );

        const source = screen.getByRole('link', { name: 'Source' });
        expect(source).toHaveAttribute('href', 'https://github.com/example/source');
        expect(source).toHaveAttribute('target', '_blank');
        expect(source.getAttribute('rel')?.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));
        fireEvent.click(source);
        expect(trackAnalyticsEvent).toHaveBeenCalledWith('project-link-click', { project: 'example', destination: 'source', placement: 'project-header' });
        fireEvent.click(screen.getByRole('link', { name: 'Data' }));
        expect(trackAnalyticsEvent).toHaveBeenCalledWith('project-link-click', { project: 'example', destination: 'data', placement: 'project-header' });

        const map = screen.getByRole('link', { name: 'Open map' });
        expect(map).toHaveAttribute('href', '/projects/example/map');
        expect(map).not.toHaveAttribute('target');
        fireEvent.click(map);
        expect(screen.getByRole('heading', { level: 1, name: 'Example map' })).toBeInTheDocument();
    });
});
