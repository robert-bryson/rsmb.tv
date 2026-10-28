import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DevelopmentContentStatus } from '../components/DevelopmentContentStatus';
import type { BlogPostMeta, DevelopmentPostMeta } from '../content/posts';

const post: BlogPostMeta = {
    slug: 'test-trip', title: 'Test trip', description: 'Synthetic trip.', date: '2024-01-01', tags: [],
    format: 'trip', tripId: 'test-trip',
};
const development: DevelopmentPostMeta = {
    published: false, rowNumber: 2, contentAvailable: true, manifestAvailable: true, issues: [],
};

afterEach(() => vi.unstubAllEnvs());

describe('development content status', () => {
    it('hides source metadata in production', () => {
        vi.stubEnv('DEV', false);
        const { container } = render(<DevelopmentContentStatus post={{ ...post, development }} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('omits the panel when development metadata is absent', () => {
        const { container } = render(<DevelopmentContentStatus post={post} />);
        expect(container).toBeEmptyDOMElement();
    });

    it.each([
        { changes: {}, format: 'trip', label: 'Draft · Ready' },
        { changes: { published: true }, format: 'trip', label: 'Published · Ready' },
        { changes: { contentAvailable: false }, format: 'trip', label: 'Draft · Incomplete' },
        { changes: { manifestAvailable: false }, format: 'trip', label: 'Draft · Incomplete' },
        { changes: { issues: ['Missing photo'] }, format: 'trip', label: 'Draft · Incomplete' },
        { changes: { manifestAvailable: false }, format: 'post', label: 'Draft · Ready' },
    ] as const)('reports $label for $format content with $changes', ({ changes, format, label }) => {
        render(<DevelopmentContentStatus compact post={{
            ...post, format, development: { ...development, ...changes, issues: [...(changes.issues ?? [])] },
        }} />);
        expect(screen.getByText(`DEV · ${label}`)).toBeVisible();
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    });

    it('explains unavailable sources, invalid manifests, and absent preview assets', () => {
        render(<DevelopmentContentStatus post={{ ...post, development: {
            ...development, manifestAvailable: false, issues: ['Photo unavailable', 'Route unavailable'],
        } }} />);
        expect(screen.getByRole('complementary', { name: 'Development metadata' })).toBeVisible();
        for (const text of ['Unpublished draft', 'Google Sheet unavailable', 'Missing or unavailable',
            'Link not configured', 'Missing or invalid', '0 WebPs · 0 GeoJSON files', 'Photo unavailable', 'Route unavailable']) {
            expect(screen.getByText(text)).toBeVisible();
        }
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('shows configured source links and prepared trip totals', () => {
        render(<DevelopmentContentStatus post={{ ...post, development: {
            ...development, published: true,
            sheetUrl: 'https://docs.google.com/spreadsheets/d/test/edit',
            documentUrl: 'https://docs.google.com/document/d/test/edit',
            driveFolderUrl: 'https://drive.google.com/drive/folders/test',
            assets: { webpFiles: 5, geoJsonFiles: 2 },
        } }} />);
        expect(screen.getByText('Published')).toBeVisible();
        expect(screen.getByText('Available')).toBeVisible();
        expect(screen.getByText('5 WebPs · 2 GeoJSON files')).toBeVisible();
        for (const [name, href] of [
            ['Google Sheet', 'https://docs.google.com/spreadsheets/d/test/edit'],
            ['Open document', 'https://docs.google.com/document/d/test/edit'],
            ['Open folder', 'https://drive.google.com/drive/folders/test'],
        ]) {
            expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
            expect(screen.getByRole('link', { name })).toHaveAttribute('rel', 'noreferrer');
        }
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('omits trip fields from ordinary post metadata', () => {
        render(<DevelopmentContentStatus post={{ ...post, format: 'post', development }} />);
        expect(screen.queryByText('Trip manifest')).not.toBeInTheDocument();
        expect(screen.queryByText('Preview assets')).not.toBeInTheDocument();
    });
});
