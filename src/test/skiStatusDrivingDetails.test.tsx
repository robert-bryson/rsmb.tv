import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import catalog from 'virtual:ski-driving-data';
import type { DrivingProvider } from '../../shared/skiDriving';
import { skiAreas } from '../features/ski-status/catalog';
import type { DrivingFeed } from '../features/ski-status/driving-feed';
import { DrivingCameraDetails, DrivingReport } from '../features/ski-status/SkiDrivingContent';
import SkiDrivingDetails from '../features/ski-status/SkiDrivingDetails';
import type { SkiDriving } from '../features/ski-status/useSkiDriving';

const checkedAt = '2026-11-22T12:00:00.000Z';
const now = Date.parse(checkedAt) + 60_000;
const camera = {
    id: '519', name: 'Whistler Village Gate', road: 'BC 99', view: 'north', point: [-122.959218, 50.116028] as [number, number],
    source: 'https://www.drivebc.ca/cameras/519', image: 'https://www.drivebc.ca/images/519.jpg?t=42',
    imageUpdatedAt: checkedAt, credit: 'DriveBC, Province of British Columbia',
};

function feed(provider: DrivingProvider): DrivingFeed {
    return { providers: { [provider]: {
        reports: { file: 'reports.json', data: { version: 1, provider, checkedAt, entries: [] } },
        reportsReady: true,
        camerasReady: false,
    } } };
}

const data: SkiDriving = { catalog, now, catalogFailed: false, feedStatus: 'available', feed: feed('drivebc') };
const whistler = skiAreas.find(area => area.id === 'whistler-blackcomb')!;
const stevens = skiAreas.find(area => area.id === 'stevens-pass')!;

describe('driving access details', () => {
    it('keeps the absence of matching reports scoped to the reviewed route and checks the entered origin', () => {
        const onFit = vi.fn();
        const onApproach = vi.fn();
        render(<SkiDrivingDetails area={whistler} data={data} units="metric" approachId="whistler-village-northbound"
            onApproach={onApproach} onFit={onFit} />);
        expect(screen.getByText('No matching reports for the mapped section and direction.')).toBeVisible();
        expect(screen.getByRole('link', { name: 'Get directions' })).toHaveAttribute('href', expect.stringContaining('destination='));
        fireEvent.click(screen.getByRole('button', { name: 'Show approach on map' }));
        expect(onFit).toHaveBeenCalledWith(expect.objectContaining({ id: 'whistler-village-northbound' }));
        fireEvent.change(screen.getByLabelText('Arrival'), { target: { value: 'whistler-creekside' } });
        expect(onApproach).toHaveBeenCalledWith('whistler-creekside-northbound');

        fireEvent.click(screen.getByText('Straight-line distance'));
        const origin = screen.getByLabelText('Origin latitude, longitude');
        fireEvent.change(origin, { target: { value: '0x32, -122.95' } });
        expect(screen.getByText('Enter latitude and longitude in decimal degrees.')).toBeVisible();
        fireEvent.change(origin, { target: { value: '50.12, -122.95' } });
        expect(screen.getByText(/km from the origin to this entrance/)).toBeVisible();
    });

    it('directs Washington users to WSDOT for current closures', () => {
        render(<SkiDrivingDetails area={stevens} units="imperial" data={{ ...data, feed: feed('wsdot') }}
            approachId="stevens-pass-eastbound" onApproach={vi.fn()} onFit={vi.fn()} />);
        const reports = screen.getByRole('region', { name: 'Road reports' });
        expect(within(reports).getByText('Check WSDOT for current closures and restrictions.')).toBeVisible();
        expect(within(reports).getByText('Last successful check', { exact: false })).toBeVisible();
        expect(within(reports).queryByText(/No matching reports/)).toBeNull();
    });

    it('labels the Caltrans estimate as a planned end while the closure is active', () => {
        render(<DrivingReport report={{ state: 'active', provider: 'caltrans', entry: {
            id: 'test-closure', road: 'I-80', title: 'Mainline work', point: [-120.34, 39.33], kind: 'closure',
            source: 'https://quickmap.dot.ca.gov/', startsAt: checkedAt, endsAt: checkedAt,
        } }} />);
        expect(screen.getByText('Closure', { exact: true })).toBeVisible();
        expect(within(screen.getByText('Planned end')).getByText(/Nov 22/)).toHaveAttribute('datetime', checkedAt);
    });

    it('makes an image request only on demand and lets the user retry a failed request', () => {
        const view = { entry: camera, provider: 'drivebc', available: true } as const;
        const { rerender } = render(<DrivingCameraDetails camera={view} now={now} />);
        expect(screen.queryByRole('img')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Show image' }));
        const image = screen.getByRole('img', { name: camera.name });
        expect(image).toHaveAttribute('src', camera.image);
        expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
        fireEvent.error(image);
        expect(screen.getByText('Camera image unavailable.')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Hide image' }));
        fireEvent.click(screen.getByRole('button', { name: 'Show image' }));
        expect(screen.getByRole('img', { name: camera.name })).toBeVisible();

        rerender(<DrivingCameraDetails camera={view} now={now + 60 * 60_000} />);
        expect(screen.queryByRole('img')).toBeNull();
        expect(screen.getByRole('link', { name: 'View on DriveBC' })).toHaveAttribute('href', camera.source);
    });
});
