import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { skiArchiveAssetUrl, type SkiArchiveTrailMap } from '../../shared/skiArchive';
import { skiAreas } from '../features/ski-status/catalog';
import { SkiPassIcon } from '../features/ski-status/SkiPassIcon';
import { SkiResortLinks } from '../features/ski-status/SkiResortLinks';
import SkiVisitorInformation from '../features/ski-status/SkiVisitorInformation';

function expand(label: string) {
    fireEvent.click(screen.getByText(label, { exact: true }));
}

describe('ski-status visitor information', () => {
    it('shows sourced maps, local prices, directions and plain webcam links', () => {
        render(<SkiVisitorInformation areaId="banff-sunshine" />);
        expect(screen.getByRole('region', { name: 'Visitor information' })).toHaveTextContent('2026/27 season');
        expand('Trail maps');
        expect(screen.getByRole('link', { name: 'Goat’s Eye Mountain and the ski-out' })).toHaveAttribute('href', expect.stringMatching(/\.pdf$/));
        expand('Lift tickets');
        expect(screen.getByText('CA$49', { selector: 'dd', exact: true })).toBeVisible();
        expect(screen.getByRole('link', { name: 'Ticket prices and terms' })).toHaveAttribute('href', expect.stringContaining('/mountain-report/'));
        expand('Bases and parking');
        expect(screen.getByRole('link', { name: 'Sunshine Gondola base' })).toHaveAttribute('href', expect.stringContaining('51.114965%2C-115.763609'));
        expect(within(screen.getByRole('region', { name: 'Parking' })).getByText('Free', { exact: true })).toBeVisible();
        expand('Webcams');
        expect(screen.getByRole('link', { name: 'Aurora Cam' })).toHaveAttribute('href', 'https://cameras.skibanff.com/dynamic/10m');
    });

    it('combines an archived copy with its published map and keeps an older edition accessible', () => {
        const source = 'https://img1.wsimg.com/blobby/go/d9686d90-24b3-48b8-a200-b81ae5e14909/BigMooseMap_web%20(1).pdf';
        const archived: SkiArchiveTrailMap = {
            areaId: 'big-moose', kind: 'trail map', source, edition: 'undated', coverage: 'The main mountain',
            relativePath: 'trail-maps/big-moose/undated/Big Moose.pdf', checkedOn: '2026-11-21', sha256: 'a'.repeat(64), byteCount: 100,
        };
        const older = { ...archived, edition: '2024/25', coverage: 'Earlier trail map', relativePath: 'trail-maps/big-moose/2024-25/Big Moose.png' };
        render(<SkiVisitorInformation areaId="big-moose" archivedMaps={[archived, older]} />);
        expand('Trail maps');
        const current = screen.getByRole('link', { name: 'Lower lift-served mountain and labeled upper-mountain routes' });
        expect(current).toHaveAttribute('href', skiArchiveAssetUrl(archived));
        expect(screen.getByRole('link', { name: 'Earlier trail map' })).toHaveAttribute('href', skiArchiveAssetUrl(older));
        expect(screen.getByText('Image · 2024/25 edition · NAS copy')).toBeVisible();
    });

    it('labels a confirmed lift base as a resort map point', () => {
        render(<SkiVisitorInformation areaId="bolton-valley-resort" />);
        expand('Bases and parking');
        const point = screen.getByRole('region', { name: 'Resort map point' });
        expect(within(point).getByRole('link', { name: 'Main Base Lodge, Vista Quad base' })).toBeVisible();
    });

    it('provides a usable icon and link when the runtime images fail', () => {
        const area = skiAreas.find(({ id }) => id === 'banff-sunshine')!;
        const { container } = render(<><SkiPassIcon family="ikon" /><SkiResortLinks area={area} /></>);
        const map = screen.getByRole('link', { name: /Google Maps/ });
        const wiki = screen.getByRole('link', { name: 'Wikipedia' });
        const images = [...container.querySelectorAll('img')];
        expect(images).toHaveLength(3);
        for (const image of images) fireEvent.error(image);
        expect(screen.getByText('IK')).toBeVisible();
        expect(map.querySelector('svg')).toBeInTheDocument();
        expect(wiki.querySelector('svg')).toBeInTheDocument();
        expect(map).toHaveAttribute('href', expect.stringContaining('google'));
    });
});
