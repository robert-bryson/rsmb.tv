import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ThroughRoutes from '../pages/ThroughRoutes';
import FlightTrackerAbout from '../pages/FlightTrackerAbout';
import AnkiArtisan from '../pages/AnkiArtisan';
import Bookend from '../pages/Bookend';
import TemperatureRecordsAbout from '../pages/TemperatureRecordsAbout';
import Route2Gpx from '../pages/Route2Gpx';

function renderWithRouter(ui: React.ReactElement, { route = '/' } = {}) {
    return render(
        <MemoryRouter initialEntries={[route]}>
            {ui}
        </MemoryRouter>
    );
}

describe('ThroughRoutes page', () => {
    it('renders heading and links', () => {
        renderWithRouter(<ThroughRoutes />, { route: '/projects/through-routes' });
        expect(screen.getByRole('heading', { level: 1, name: /Through Routes/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Visit Through Routes/i })).toHaveAttribute('href', 'https://through-routes.rsmb.tv/');
        expect(screen.getByRole('link', { name: /Source on GitHub/i })).toBeInTheDocument();
    });
});

describe('FlightTrackerAbout page', () => {
    it('renders heading and map link', () => {
        renderWithRouter(<FlightTrackerAbout />, { route: '/projects/flights' });
        expect(screen.getByRole('heading', { level: 1, name: /Flight Tracker/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Open interactive globe/i })).toHaveAttribute('href', '/projects/flights/map');
    });
});

describe('AnkiArtisan page', () => {
    it('renders heading and GitHub link', () => {
        renderWithRouter(<AnkiArtisan />, { route: '/projects/anki-artisan' });
        expect(screen.getByRole('heading', { level: 1, name: /Anki Artisan/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Source on GitHub/i })).toHaveAttribute('href', 'https://github.com/robert-bryson/anki-artisan');
    });
});

describe('Bookend page', () => {
    it('renders heading and both links', () => {
        renderWithRouter(<Bookend />, { route: '/projects/bookend' });
        expect(screen.getByRole('heading', { level: 1, name: /Bookend/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Visit Bookend/i })).toHaveAttribute('href', 'https://bookend.rsmb.tv');
        expect(screen.getByRole('link', { name: /Source on GitHub/i })).toHaveAttribute('href', 'https://github.com/robert-bryson/bookend');
    });
});

describe('TemperatureRecordsAbout page', () => {
    it('renders heading and map/trends links', () => {
        renderWithRouter(<TemperatureRecordsAbout />, { route: '/projects/temperature-records' });
        expect(screen.getByRole('heading', { level: 1, name: /US Temperature Records/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Open interactive map/i })).toHaveAttribute('href', '/projects/temperature-records/map');
        expect(screen.getByRole('link', { name: /View climate trends/i })).toHaveAttribute('href', '/projects/temperature-records/trends');
    });
});

describe('Route2Gpx page', () => {
    it('renders heading and links', () => {
        renderWithRouter(<Route2Gpx />, { route: '/projects/route2gpx' });
        expect(screen.getByRole('heading', { level: 1, name: /route2gpx/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Visit route2gpx/i })).toHaveAttribute('href', 'https://route2gpx.rsmb.tv');
        expect(screen.getByRole('link', { name: /Source on GitHub/i })).toHaveAttribute('href', 'https://github.com/robert-bryson/route2gpx');
    });
});
