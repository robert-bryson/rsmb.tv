import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MdxImage } from '../blog/MdxImage';

describe('MdxImage', () => {
    it('uses an image title as an accessible, dismissible caption', () => {
        render(<MdxImage src="/photo.webp" alt="A mountain road" title="Crossing the pass at dusk." />);

        const image = screen.getByRole('img', { name: 'A mountain road' });
        const caption = screen.getByText('Crossing the pass at dusk.');
        const wrapper = caption.closest('.image-caption-figure');

        expect(image).not.toHaveAttribute('title');
        expect(image).toHaveAttribute('aria-describedby', caption.id);
        expect(wrapper).toHaveAttribute('tabindex', '0');

        fireEvent.keyDown(wrapper!, { key: 'Escape' });
        expect(wrapper).toHaveAttribute('data-caption-dismissed', 'true');
        fireEvent.blur(wrapper!, { relatedTarget: null });
        expect(wrapper).not.toHaveAttribute('data-caption-dismissed');
    });

    it('uses alt text as a visual-only fallback when no title is available', () => {
        const { container } = render(<MdxImage src="/photo.webp" alt="A mountain road" />);

        expect(container.querySelector('.image-caption-figure')).toBeInTheDocument();
        expect(screen.getByText('A mountain road')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByRole('img', { name: 'A mountain road' })).not.toHaveAttribute('aria-describedby');
    });

    it('renders a plain lazy image when no caption text is available', () => {
        const { container } = render(<MdxImage src="/decorative.webp" alt="" />);

        expect(container.querySelector('.image-caption-figure')).not.toBeInTheDocument();
        expect(screen.getByRole('presentation')).toHaveAttribute('loading', 'lazy');
    });
});