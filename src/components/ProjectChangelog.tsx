import type { ChangelogEntry } from '../content/projects';
import { formatDate, formatMonthYear } from '../utils/formatDate';

interface ProjectChangelogProps {
    entries: ChangelogEntry[];
}

export function ProjectChangelog({ entries }: ProjectChangelogProps) {
    if (!entries || entries.length === 0) return null;

    return (
        <div>
            <h2 className="text-lg font-medium text-zinc-100 mb-4">Changelog</h2>
            <dl className="space-y-3 text-sm">
                {entries.map(({ date, notes }) => (
                    <div key={date} className="grid gap-x-4 gap-y-1 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
                        <dt className="text-zinc-500 tabular-nums whitespace-nowrap">
                            <time dateTime={date}>
                                {date.length === 7 ? formatMonthYear(date) : formatDate(date, 'short')}
                            </time>
                        </dt>
                        <dd className="min-w-0 text-zinc-400">
                            <ul className="list-disc space-y-1 pl-4 marker:text-zinc-600">
                                {notes.map((note) => (
                                    <li key={note}>{note}</li>
                                ))}
                            </ul>
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
