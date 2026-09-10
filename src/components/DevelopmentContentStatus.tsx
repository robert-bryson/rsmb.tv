import type { BlogPostMeta } from '../content/posts';

interface DevelopmentContentStatusProps {
    post: BlogPostMeta;
    compact?: boolean;
}

export function DevelopmentContentStatus({ post, compact = false }: DevelopmentContentStatusProps) {
    if (!import.meta.env.DEV || !post.development) return null;

    const { development } = post;
    const ready = development.contentAvailable
        && (post.format !== 'trip' || development.manifestAvailable)
        && development.issues.length === 0;

    if (compact) {
        return (
            <span className={`inline-flex border px-2 py-0.5 text-xs font-medium ${development.published ? 'border-emerald-800 bg-emerald-950 text-emerald-300' : 'border-amber-800 bg-amber-950 text-amber-300'}`}>
                DEV · {development.published ? 'Published' : 'Draft'} · {ready ? 'Ready' : 'Incomplete'}
            </span>
        );
    }

    return (
        <aside className="mb-8 border border-amber-800 bg-amber-950/40 p-4 text-sm text-zinc-300" aria-label="Development metadata">
            <h2 className="font-semibold text-amber-300">Development metadata</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-[max-content_1fr]">
                <dt className="text-zinc-500">Publication</dt>
                <dd>{development.published ? 'Published' : 'Unpublished draft'}</dd>
                <dt className="text-zinc-500">Source</dt>
                <dd>
                    {development.sheetUrl ? (
                        <a className="text-amber-300 underline hover:text-amber-200" href={development.sheetUrl} target="_blank" rel="noreferrer">Google Sheet</a>
                    ) : 'Google Sheet unavailable'}
                </dd>
                <dt className="text-zinc-500">Google Doc</dt>
                <dd>
                    {development.documentUrl ? (
                        <a className="text-amber-300 underline hover:text-amber-200" href={development.documentUrl} target="_blank" rel="noreferrer">Open document</a>
                    ) : 'Missing or unavailable'}
                </dd>
                <dt className="text-zinc-500">Drive folder</dt>
                <dd>
                    {development.driveFolderUrl ? (
                        <a className="text-amber-300 underline hover:text-amber-200" href={development.driveFolderUrl} target="_blank" rel="noreferrer">Open folder</a>
                    ) : 'Link not configured'}
                </dd>
                {post.format === 'trip' && (
                    <>
                        <dt className="text-zinc-500">Trip manifest</dt>
                        <dd>{development.manifestAvailable ? 'Available' : 'Missing or invalid'}</dd>
                        <dt className="text-zinc-500">Preview assets</dt>
                        <dd>
                            {development.assets?.webpFiles ?? 0} WebPs · {development.assets?.geoJsonFiles ?? 0} GeoJSON files
                        </dd>
                    </>
                )}
            </dl>
            {development.issues.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-amber-200">
                    {development.issues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
            )}
        </aside>
    );
}