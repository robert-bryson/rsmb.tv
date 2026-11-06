import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkipLink } from '../features/flights/components/SkipLink';

describe('SkipLink', () => {
    it('focuses the actual control without scrolling or changing the URL fragment', () => {
        render(<>
            <SkipLink />
            <button id="flight-stats-toggle">Show stats panel</button>
        </>);
        const link = screen.getByRole('link', { name: 'Skip to controls' });
        const target = screen.getByRole('button', { name: 'Show stats panel' });
        const focus = vi.spyOn(target, 'focus');
        link.focus();
        const click = new MouseEvent('click', { bubbles: true, cancelable: true });

        fireEvent(link, click);

        expect(click.defaultPrevented).toBe(true);
        expect(target).toHaveFocus();
        expect(focus).toHaveBeenCalledWith({ preventScroll: true });
        expect(link).toHaveAttribute('href', '#flight-stats-toggle');
    });

    it('preserves native fragment navigation when the control is unavailable', () => {
        render(<SkipLink />);
        const click = new MouseEvent('click', { bubbles: true, cancelable: true });

        fireEvent(screen.getByRole('link', { name: 'Skip to controls' }), click);

        expect(click.defaultPrevented).toBe(false);
    });
});
