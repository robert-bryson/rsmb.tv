import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProjectPageHeader } from '../components/ProjectPageHeader';
import { renderWithRouter } from './helpers/router';

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
                            { label: 'Source', href: 'https://example.org/source', external: true },
                        ]}
                    />
                )} />
                <Route path="/projects/example/map" element={<h1>Example map</h1>} />
            </Routes>,
            { route: '/projects/example' },
        );

        const source = screen.getByRole('link', { name: 'Source' });
        expect(source).toHaveAttribute('href', 'https://example.org/source');
        expect(source).toHaveAttribute('target', '_blank');
        expect(source.getAttribute('rel')?.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']));

        const map = screen.getByRole('link', { name: 'Open map' });
        expect(map).toHaveAttribute('href', '/projects/example/map');
        expect(map).not.toHaveAttribute('target');
        fireEvent.click(map);
        expect(screen.getByRole('heading', { level: 1, name: 'Example map' })).toBeInTheDocument();
    });
});
