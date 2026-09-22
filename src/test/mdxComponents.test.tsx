import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mdxComponents } from '../blog/MdxComponents';

const Anchor = mdxComponents.a;

describe('MDX links', () => {
    it.each([
        'https://rsmb.tv/trips/ocean-shores-2024',
        'https://www.rsmb.tv/blog/example',
        '/projects/flights',
    ])('opens internal link %s in the same tab', (href) => {
        render(<Anchor href={href}>Internal</Anchor>);

        const link = screen.getByRole('link', { name: 'Internal' });
        expect(link).not.toHaveAttribute('target');
        expect(link).not.toHaveAttribute('rel');
    });

    it.each([
        'https://example.com',
        'HTTPS://EXAMPLE.COM/path',
        'https://blog.rsmb.tv',
    ])('opens external HTTP link %s in a new tab', (href) => {
        render(<Anchor href={href}>External</Anchor>);

        const link = screen.getByRole('link', { name: 'External' });
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('does not crash on a malformed URL', () => {
        render(<Anchor href="https://[">Malformed</Anchor>);

        expect(screen.getByRole('link', { name: 'Malformed' })).not.toHaveAttribute('target');
    });

    it('does not let MDX override external-link protections', () => {
        render(
            <Anchor href="https://example.com" target="_self" rel="opener">
                Protected
            </Anchor>,
        );

        const link = screen.getByRole('link', { name: 'Protected' });
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
});