import type { ChangelogEntry } from '../content/projects';

interface ProjectChangelogProps {
    entries: ChangelogEntry[];
}

function formatDate(iso: string): string {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day ?? 1).toLocaleDateString('en-US', {
        month: 'short',
        day: day ? 'numeric' : undefined,
        year: 'numeric',
    });
}

export function ProjectChangelog({ entries }: ProjectChangelogProps) {
    if (!entries || entries.length === 0) return null;

    return (
        <div>
            <h2 className="text-lg font-medium text-zinc-100 mb-4">Changelog</h2>
            <dl className="space-y-3 text-sm">
                {entries.map(({ date, notes }) => (
                    <div key={date} className="grid grid-cols-[7.5rem_1fr] gap-x-3">
                        <dt className="text-zinc-500 tabular-nums whitespace-nowrap pt-0.5">
                            {formatDate(date)}
                        </dt>
                        <dd className="text-zinc-400">
                            {notes.length === 1 ? (
                                notes[0]
                            ) : (
                                <ul className="space-y-1">
                                    {notes.map((note) => (
                                        <li
                                            key={note}
                                            className="before:content-['–'] before:mr-1.5 before:text-zinc-600"
                                        >
                                            {note}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
