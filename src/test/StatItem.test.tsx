import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatItem } from '../features/flights/components/shared';

describe('StatItem', () => {
    it('renders static stats without button semantics', () => {
        render(<StatItem icon="*" label="Airports" value="112" />);

        expect(screen.getByText('Airports')).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders clickable stats as accessible toggle buttons', () => {
        const onClick = vi.fn();
        render(
            <StatItem
                icon="*"
                label="Domestic"
                value="240"
                onClick={onClick}
                isSelected
                ariaLabel="Clear domestic flight type filter"
            />,
        );

        const button = screen.getByRole('button', { name: 'Clear domestic flight type filter' });
        expect(button).toHaveAttribute('type', 'button');
        expect(button).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(button);

        expect(onClick).toHaveBeenCalledOnce();
    });
});