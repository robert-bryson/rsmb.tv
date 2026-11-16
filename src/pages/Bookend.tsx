import { ProjectPageHeader } from '../components/ProjectPageHeader';
import { TechBadges } from '../components/TechBadges';
import { ProjectScreenshotGallery, type ProjectScreenshot } from '../components/ProjectScreenshotGallery';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';
import { projects } from '../content/projects';
import { ProjectChangelog } from '../components/ProjectChangelog';

const BOOKEND_URL = 'https://bookend.rsmb.tv';

const screenshots: ProjectScreenshot[] = [
    {
        src: '/images/bookend/bookend-home.webp',
        alt: 'Bookend public reading demo with the current book, annual goal, reading totals, and award-list progress',
        caption: 'Public reading demo — explore the reading dashboard and list progress without signing in.',
        width: 1600,
        height: 1000,
        loading: 'eager',
    },
    {
        src: '/images/bookend/bookend-award-lists.webp',
        alt: 'Booker Prize Fiction award list showing recognition years, award status, and the public demo reader’s progress',
        caption: 'Award list view — browse Booker Prize entries in a table with award and reading filters, sourced context, and demo progress.',
        width: 1600,
        height: 1000,
    },
    {
        src: '/images/bookend/bookend-book-detail.webp',
        alt: 'Book detail page for Lincoln in the Bardo showing enriched metadata, subjects, tags, and reading history',
        caption: 'Book detail — Lincoln in the Bardo with enriched metadata, award recognition, edition links, and public reading history.',
        width: 1600,
        height: 1000,
    },
    {
        src: '/images/bookend/bookend-profile.webp',
        alt: 'Bookend reading profile with period controls, finished reads, author totals, monthly activity, and reading highlights',
        caption: 'Reading profile — compare periods and explore activity, authors, formats, languages, and book patterns.',
        width: 1600,
        height: 1000,
    },
];

export default function Bookend() {
    usePageMetadata(staticPageMetadata('/projects/bookend'));

    const project = projects.find(p => p.slug === 'bookend')!;

    return (
        <div className="max-w-[52rem]">
            <ProjectPageHeader
                title="Bookend"
                stack="Next.js + PostgreSQL"
                description={(
                    <>
                        Track reading, explore award lists, and compare reading patterns
                        across five analytics views. Try the public demo without an account.
                        Integrates with{' '}
                        <a
                            href="https://developers.google.com/books"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 underline decoration-violet-400/30 hover:decoration-violet-400"
                        >
                            Google Books
                        </a>
                        ,{' '}
                        <a
                            href="https://openlibrary.org/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 underline decoration-violet-400/30 hover:decoration-violet-400"
                        >
                            Open Library
                        </a>
                        , and{' '}
                        <a
                            href="https://www.wikidata.org/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 underline decoration-violet-400/30 hover:decoration-violet-400"
                        >
                            Wikidata
                        </a>{' '}
                        for covers, descriptions, author links, and other metadata.
                        Administrators can protect corrected fields from enrichment and undo.
                    </>
                )}
                actions={[
                    { label: 'Open Bookend →', href: BOOKEND_URL, variant: 'primary', external: true },
                    { label: 'Try the public reading demo →', href: `${BOOKEND_URL}/demo`, external: true },
                    { label: 'Source on GitHub →', href: 'https://github.com/robert-bryson/bookend', external: true },
                ]}
            />

            <ProjectScreenshotGallery screenshots={screenshots} />

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Features</h2>
            <ul className="space-y-1.5 text-zinc-400 text-sm mb-6 list-disc list-inside">
                <li>Search and add books via Google Books or Open Library</li>
                <li>Log reads with dates, ratings, and notes</li>
                <li>Organize books into custom lists and shelves</li>
                <li>Five reading analytics views with period comparisons, reading-history links, and exports</li>
                <li>Public demo with a reading dashboard, log, award progress, and profile analytics</li>
                <li>Bulk personal-list assignment that preserves mixed memberships until you change them</li>
                <li>Global search with direct links to complete book and author catalog results</li>
                <li>
                    Auto-enrichment from multiple sources: covers, descriptions,
                    page counts, author bios
                </li>
                <li>Wikidata linking for author pages and canonical metadata</li>
                <li>Administrator controls to protect corrected book and author fields</li>
                <li>Dockerized for easy self-hosting</li>
            </ul>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Tech Stack</h2>
            <TechBadges tech={project.tech} className="mb-8" />
            <ProjectChangelog entries={project.changelog ?? []} />
        </div>
    );
}
