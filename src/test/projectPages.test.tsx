import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import ThroughRoutes from '../pages/ThroughRoutes';
import FlightsAbout from '../pages/FlightsAbout';
import AnkiArtisan from '../pages/AnkiArtisan';
import Bookend from '../pages/Bookend';
import TemperatureRecordsAbout from '../pages/TemperatureRecordsAbout';
import TornadoTracksAbout from '../pages/TornadoTracksAbout';
import Route2Gpx from '../pages/Route2Gpx';
import Aborg from '../pages/Aborg';
import Parc from '../pages/Parc';
import { renderWithRouter } from './helpers/router';

describe('ThroughRoutes page', () => {
    it('renders heading, links, and screenshots', () => {
        renderWithRouter(<ThroughRoutes />, { route: '/projects/through-routes' });
        expect(screen.getByRole('heading', { level: 1, name: /Through Routes/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Open Through Routes/i })).toHaveAttribute('href', 'https://through-routes.rsmb.tv/');
        expect(screen.getByRole('link', { name: /Source on GitHub/i })).toHaveAttribute('href', 'https://github.com/robert-bryson/through-routes');
        expect(screen.getByRole('img', { name: /roads colored by curviness score/i })).toHaveAttribute('src', '/images/through-routes/through-routes-curviness-map.webp');
        expect(screen.getByRole('img', { name: /broad region with roads scored by curviness/i })).toHaveAttribute('src', '/images/through-routes/through-routes-overview.webp');
        expect(screen.getByRole('img', { name: /Road detail panel for US 2 near Seattle/i })).toHaveAttribute('src', '/images/through-routes/through-routes-road-detail.webp');
        expect(screen.getByText(/Curviness heat map/i)).toBeInTheDocument();
    });
});

describe('FlightsAbout page', () => {
    it('renders heading, map link, and source link', () => {
        renderWithRouter(<FlightsAbout />, { route: '/projects/flights' });
        expect(screen.getByRole('heading', { level: 1, name: /Flights/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Open interactive globe/i })).toHaveAttribute('href', '/projects/flights/map');
        expect(screen.getByRole('link', { name: /Source on GitHub/i })).toHaveAttribute('href', 'https://github.com/robert-bryson/rsmb.tv/tree/main/src/features/flights');
    });
});

describe('AnkiArtisan page', () => {
    it('renders heading, GitHub link, and screenshots', () => {
        renderWithRouter(<AnkiArtisan />, { route: '/projects/anki-artisan' });
        expect(screen.getByRole('heading', { level: 1, name: /Anki Artisan/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Source on GitHub/i })).toHaveAttribute('href', 'https://github.com/robert-bryson/anki-artisan');
        expect(screen.getByRole('img', { name: /six iNaturalist plant photos/i })).toHaveAttribute('src', '/images/anki-artisan/anki-artisan-visual-id.webp');
        expect(screen.getByRole('img', { name: /genus Cercis/i })).toHaveAttribute('src', '/images/anki-artisan/anki-artisan-nomenclature-sci-common.webp');
        expect(screen.getByRole('img', { name: /Black-necked Stilt/i })).toHaveAttribute('src', '/images/anki-artisan/anki-artisan-nomenclature-common-sci.webp');
        expect(screen.getByText(/six iNaturalist photos; identify the order/i)).toBeInTheDocument();
    });
});

describe('Bookend page', () => {
    it('renders heading, links, and screenshots', () => {
        renderWithRouter(<Bookend />, { route: '/projects/bookend' });
        expect(screen.getByRole('heading', { level: 1, name: /Bookend/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Open Bookend/i })).toHaveAttribute('href', 'https://bookend.rsmb.tv');
        expect(screen.getByRole('link', { name: /Source on GitHub/i })).toHaveAttribute('href', 'https://github.com/robert-bryson/bookend');
        expect(screen.getByRole('img', { name: /Bookend home page/i })).toHaveAttribute('src', '/images/bookend/bookend-home.webp');
        expect(screen.getByRole('img', { name: /Booker Prize Fiction award list/i })).toHaveAttribute('src', '/images/bookend/bookend-award-lists.webp');
        expect(screen.getByRole('img', { name: /Book detail page for Lincoln in the Bardo/i })).toHaveAttribute('src', '/images/bookend/bookend-book-detail.webp');
        expect(screen.getByText(/Award list view/i)).toBeInTheDocument();
    });
});

describe('TemperatureRecordsAbout page', () => {
    it('renders heading, map/trends links, and source link', () => {
        renderWithRouter(<TemperatureRecordsAbout />, { route: '/projects/temperature-records' });
        expect(screen.getByRole('heading', { level: 1, name: /Record Highs/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Open interactive map/i })).toHaveAttribute('href', '/projects/temperature-records/map?view=freshness');
        expect(screen.getByRole('link', { name: /View climate trends/i })).toHaveAttribute('href', '/projects/temperature-records/trends');
        expect(screen.getByRole('link', { name: /Source on GitHub/i })).toHaveAttribute('href', 'https://github.com/robert-bryson/rsmb.tv/tree/main/src/features/temperatures');
    });
});

describe('TornadoTracksAbout page', () => {
    it('renders heading, links, and screenshots', () => {
        renderWithRouter(<TornadoTracksAbout />, { route: '/projects/tornado-tracks' });
        expect(screen.getByRole('heading', { level: 1, name: /Tornado Tracks/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Open interactive map/i })).toHaveAttribute('href', '/projects/tornado-tracks/map');
        expect(screen.getByRole('link', { name: /Source on GitHub/i })).toHaveAttribute('href', 'https://github.com/robert-bryson/rsmb.tv/tree/main/src/features/tornadoes');
        expect(screen.getByRole('link', { name: /NOAA source data/i })).toHaveAttribute('href', 'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/');
        expect(screen.getByRole('img', { name: /Map of 2025 tornado tracks across the continental United States/i })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /Map focused on St. Louis with a selected EF3 tornado track detail popup/i })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /Tornado Trends view showing annual counts, fatality rate, decade comparison, and top states/i })).toBeInTheDocument();
    });
});

describe('Route2Gpx page', () => {
    it('renders heading and links', () => {
        renderWithRouter(<Route2Gpx />, { route: '/projects/route2gpx' });
        expect(screen.getByRole('heading', { level: 1, name: /route2gpx/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Open route2gpx/i })).toHaveAttribute('href', 'https://route2gpx.rsmb.tv');
        expect(screen.getByRole('link', { name: /Source on GitHub/i })).toHaveAttribute('href', 'https://github.com/robert-bryson/route2gpx');
    });
});

describe('Aborg page', () => {
    it('renders heading, source link, and usage commands', () => {
        renderWithRouter(<Aborg />, { route: '/projects/aborg' });
        expect(screen.getByRole('heading', { level: 1, name: /aborg/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Source on GitHub/i })).toHaveAttribute('href', 'https://github.com/robert-bryson/aborg');
        expect(screen.getByText(/aborg fetch --latest 1 --organize/i)).toBeInTheDocument();
    });
});

describe('Parc page', () => {
    it('renders heading, source link, screenshot, and usage commands', () => {
        renderWithRouter(<Parc />, { route: '/projects/parc' });
        expect(screen.getByRole('heading', { level: 1, name: /parc/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Source on GitHub/i })).toHaveAttribute('href', 'https://github.com/robert-bryson/parc');
        expect(screen.getByRole('img', { name: /parc update live progress output/i })).toHaveAttribute('src', '/images/parc/update-live-progress.webp');
        expect(screen.getByText(/parc update/i)).toBeInTheDocument();
    });
});
