import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AirlinesSection } from '../features/flights/components/AirlinesSection';

const airlineCounts = Array.from({ length: 8 }, (_, index) => ({ airline: `Airline ${index + 1}`, count: index + 1 }));

function createProps() {
    return { airlineCounts, selectedAirline: null as string | null, onAirlineSelect: vi.fn(), isOpen: true, onToggle: vi.fn() };
}

describe('AirlinesSection', () => {
    it('exposes the selected airline and clears it through either the airline or All button', () => {
        const props = createProps();
        const { rerender } = render(<AirlinesSection {...props} />);
        const all = screen.getByRole('button', { name: 'All' });
        const airline = screen.getByRole('button', { name: 'Airline 1 ×1' });
        expect(all).toHaveAttribute('aria-pressed', 'true');
        expect(airline).toHaveAttribute('aria-pressed', 'false');

        fireEvent.click(airline);
        expect(props.onAirlineSelect).toHaveBeenLastCalledWith('Airline 1');
        rerender(<AirlinesSection {...props} selectedAirline="Airline 1" />);
        expect(all).toHaveAttribute('aria-pressed', 'false');
        expect(airline).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(airline);
        expect(props.onAirlineSelect).toHaveBeenLastCalledWith(null);
        fireEvent.click(all);
        expect(props.onAirlineSelect).toHaveBeenLastCalledWith(null);
    });

    it('expands and collapses the list without submitting an enclosing form', () => {
        const onSubmit = vi.fn(event => event.preventDefault());
        render(<form onSubmit={onSubmit}><AirlinesSection {...createProps()} /></form>);
        expect(screen.queryByRole('button', { name: 'Airline 7 ×7' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Show 2 more →' }));
        expect(screen.getByRole('button', { name: 'Airline 7 ×7' })).toBeVisible();
        expect(onSubmit).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: '← Show less' }));
        expect(screen.queryByRole('button', { name: 'Airline 7 ×7' })).not.toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('keeps the unknown-airline selection distinct from All', () => {
        const props = { ...createProps(), airlineCounts: [{ airline: '', count: 2 }] };
        const { rerender } = render(<AirlinesSection {...props} />);
        const unknown = screen.getByRole('button', { name: '(Unknown) ×2' });
        fireEvent.click(unknown);
        expect(props.onAirlineSelect).toHaveBeenLastCalledWith('');

        rerender(<AirlinesSection {...props} selectedAirline="" />);
        expect(unknown).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.queryByRole('button', { name: /Show .* more/ })).not.toBeInTheDocument();
    });
});
