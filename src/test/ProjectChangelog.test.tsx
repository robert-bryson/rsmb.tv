import { render, screen, within } from '@testing-library/react';
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

    it('renders a single note as a bullet list', () => {
        render(<ProjectChangelog entries={[{ date: '2026-05', notes: ['Added feature X'] }]} />);
        expect(screen.getByRole('list')).toBeInTheDocument();
        expect(screen.getByRole('listitem')).toHaveTextContent('Added feature X');
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
        expect(screen.getByRole('time')).toHaveAttribute('datetime', '2026-05-15');
    });

    it.each([
        ['0099-05', 'May 99'],
        ['0099-05-15', 'May 15, 99'],
        ['2024-02-29', 'Feb 29, 2024'],
        ['2026-13', '2026-13'],
        ['2026-02-30', '2026-02-30'],
    ])('does not silently change the calendar date %s', (date, expected) => {
        render(<ProjectChangelog entries={[{ date, notes: ['Example feature'] }]} />);
        expect(screen.getByText(expected)).toBeInTheDocument();
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
        const dates = screen.getAllByRole('time');
        expect(dates.map(date => date.textContent)).toEqual(['Jun 2026', 'May 2026']);
        expect(dates.map(date => date.getAttribute('datetime'))).toEqual(['2026-06', '2026-05']);

        for (const [index, note] of ['June entry', 'May entry'].entries()) {
            const row = dates[index].closest('dt')!.parentElement!;
            expect(within(row).getAllByRole('listitem')).toHaveLength(1);
            expect(within(row).getByRole('listitem')).toHaveTextContent(note);
        }
    });
});
