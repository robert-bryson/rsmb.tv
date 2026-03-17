import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Home } from '../pages/Home';
import { About } from '../pages/About';
import { Projects } from '../pages/Projects';
import { NotFound } from '../pages/NotFound';

function renderWithRouter(ui: React.ReactElement, { route = '/' } = {}) {
    return render(
        <MemoryRouter initialEntries={[route]}>
            {ui}
        </MemoryRouter>
    );
}

describe('Home page', () => {
    it('renders greeting', () => {
        renderWithRouter(<Home />);
        expect(screen.getByText(/Hi, I'm Robby/i)).toBeInTheDocument();
    });

    it('renders featured section', () => {
        renderWithRouter(<Home />);
        expect(screen.getByText('Featured')).toBeInTheDocument();
    });

    it('renders "View all projects" link', () => {
        renderWithRouter(<Home />);
        expect(screen.getByText(/View all projects/i)).toBeInTheDocument();
    });
});

describe('About page', () => {
    it('renders about heading', () => {
        renderWithRouter(<About />, { route: '/about' });
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
});

describe('Projects page', () => {
    it('renders projects heading', () => {
        renderWithRouter(<Projects />, { route: '/projects' });
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
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
