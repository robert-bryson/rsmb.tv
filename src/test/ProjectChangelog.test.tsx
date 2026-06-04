import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProjectChangelog } from '../components/ProjectChangelog';

describe('ProjectChangelog', () => {
    it('renders nothing when entries array is empty', () => {
        const { container } = render(<ProjectChangelog entries={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders the Changelog heading', () => {
        render(<ProjectChangelog entries={[{ date: '2026-05', notes: ['Initial launch'] }]} />);
        expect(screen.getByRole('heading', { name: /Changelog/i })).toBeInTheDocument();
    });

    it('renders a single note as plain text without a list', () => {
        render(<ProjectChangelog entries={[{ date: '2026-05', notes: ['Added feature X'] }]} />);
        expect(screen.getByText('Added feature X')).toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('renders multiple notes as a list', () => {
        render(
            <ProjectChangelog
                entries={[{ date: '2026-06', notes: ['Added feature X', 'Fixed bug Y', 'Improved performance'] }]}
            />,
        );
        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(3);
        expect(screen.getByText('Added feature X')).toBeInTheDocument();
        expect(screen.getByText('Fixed bug Y')).toBeInTheDocument();
        expect(screen.getByText('Improved performance')).toBeInTheDocument();
    });

    it('formats a month-year date as "Mon YYYY"', () => {
        render(<ProjectChangelog entries={[{ date: '2026-05', notes: ['note'] }]} />);
        expect(screen.getByText('May 2026')).toBeInTheDocument();
    });

    it('formats a full ISO date as "Mon D, YYYY"', () => {
        render(<ProjectChangelog entries={[{ date: '2026-05-15', notes: ['note'] }]} />);
        expect(screen.getByText('May 15, 2026')).toBeInTheDocument();
    });

    it('renders multiple entries in order', () => {
        render(
            <ProjectChangelog
                entries={[
                    { date: '2026-06', notes: ['June entry'] },
                    { date: '2026-05', notes: ['May entry'] },
                ]}
            />,
        );
        const dts = document.querySelectorAll('dt');
        expect(dts[0]?.textContent).toBe('Jun 2026');
        expect(dts[1]?.textContent).toBe('May 2026');
    });
});
