import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TornadoTimeline } from '../features/tornadoes/components/TornadoTimeline';
import type { AnnualTornadoSummary } from '../features/tornadoes/types';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const annualSummary = [2020, 2021, 2022].map(year => ({ year, count: 1 }) as AnnualTornadoSummary);

describe('review regressions: timeline keyboard access', () => {
    it('keeps one histogram year in the tab order when a range starts in a gap', () => {
        const onYearRangeChange = vi.fn();
        const annualSummary = [2020, 2022].map(year => ({ year, count: 1 }) as AnnualTornadoSummary);
        render(<TornadoTimeline annualSummary={annualSummary} startYear={2021} endYear={2022}
            minYear={2020} maxYear={2022} onYearRangeChange={onYearRangeChange} />);
        const histogram = screen.getByRole('group', { name: 'Annual track counts' });
        const buttons = within(histogram).getAllByRole('button');
        expect(buttons.filter(button => button.tabIndex === 0)).toEqual([buttons[1]]);
        fireEvent.keyDown(buttons[1], { key: 'ArrowLeft' });
        expect(onYearRangeChange).toHaveBeenCalledWith(2020, 2020);
        expect(buttons[0]).toHaveFocus();
    });

    it('plays through years, wraps at the end, and stops after Pause', () => {
        vi.useFakeTimers();
        const onYearRangeChange = vi.fn();
        const onPlayingChange = vi.fn();
        const props = { annualSummary, minYear: 2020, maxYear: 2022, onYearRangeChange, onPlayingChange };
        const { rerender } = render(<TornadoTimeline {...props} startYear={2020} endYear={2020} />);
        fireEvent.click(screen.getByRole('button', { name: 'Play' }));
        expect(onPlayingChange).toHaveBeenLastCalledWith(true);
        act(() => vi.advanceTimersByTime(850));
        expect(onYearRangeChange).toHaveBeenLastCalledWith(2021, 2021);
        rerender(<TornadoTimeline {...props} startYear={2022} endYear={2022} />);
        act(() => vi.advanceTimersByTime(850));
        expect(onYearRangeChange).toHaveBeenLastCalledWith(2020, 2020);
        fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
        expect(onPlayingChange).toHaveBeenLastCalledWith(false);
        onYearRangeChange.mockClear();
        act(() => vi.advanceTimersByTime(5000));
        expect(onYearRangeChange).not.toHaveBeenCalled();
    });

    it('keeps year steps and range sliders inside their boundaries', () => {
        const onYearRangeChange = vi.fn();
        const props = { annualSummary, minYear: 2020, maxYear: 2022, onYearRangeChange };
        const { rerender } = render(<TornadoTimeline {...props} startYear={2020} endYear={2020} />);
        fireEvent.click(screen.getByRole('button', { name: 'Prev' }));
        expect(onYearRangeChange).toHaveBeenLastCalledWith(2020, 2020);
        fireEvent.change(screen.getByRole('slider', { name: 'Start 2020' }), { target: { value: '2022' } });
        expect(onYearRangeChange).toHaveBeenLastCalledWith(2020, 2020);
        rerender(<TornadoTimeline {...props} startYear={2022} endYear={2022} />);
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(onYearRangeChange).toHaveBeenLastCalledWith(2022, 2022);
        fireEvent.change(screen.getByRole('slider', { name: 'End 2022' }), { target: { value: '2020' } });
        expect(onYearRangeChange).toHaveBeenLastCalledWith(2022, 2022);
    });

    it('limits a partial final decade and removes playback timers on unmount', () => {
        vi.useFakeTimers();
        const onYearRangeChange = vi.fn();
        const { unmount } = render(<TornadoTimeline annualSummary={annualSummary} startYear={2010} endYear={2019}
            minYear={1950} maxYear={2022} onYearRangeChange={onYearRangeChange} />);
        fireEvent.click(screen.getByRole('button', { name: '10yr' }));
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        expect(onYearRangeChange).toHaveBeenLastCalledWith(2020, 2022);
        fireEvent.click(screen.getByRole('button', { name: 'Play' }));
        act(() => vi.advanceTimersByTime(2000));
        expect(onYearRangeChange).toHaveBeenLastCalledWith(2020, 2022);
        unmount();
        onYearRangeChange.mockClear();
        act(() => vi.advanceTimersByTime(5000));
        expect(onYearRangeChange).not.toHaveBeenCalled();
    });
});
