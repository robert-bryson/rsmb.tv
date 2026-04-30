import { ProjectScreenshotGallery, type ProjectScreenshot } from '../components/ProjectScreenshotGallery';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';

const screenshots: ProjectScreenshot[] = [
    {
        src: '/images/bookend/bookend-home.webp',
        alt: 'Bookend home page with hero text, feature highlights, and site statistics',
        caption: 'Home page — feature highlights and catalogue statistics including 22,510 award-winning books and 3,115 enriched authors',
        width: 1656,
        height: 1618,
        loading: 'eager',
    },
    {
        src: '/images/bookend/bookend-award-lists.webp',
        alt: 'Booker Prize Fiction award list showing books by year with scores and reading progress indicators',
        caption: 'Award list view — Booker Prize Fiction entries by year with scores, author links, and per-book reading progress',
        width: 1854,
        height: 1387,
    },
    {
        src: '/images/bookend/bookend-book-detail.webp',
        alt: 'Book detail page for Lincoln in the Bardo showing enriched metadata, subjects, tags, and reading history',
        caption: 'Book detail — auto-enriched metadata from Open Library and Wikidata: subjects, publisher, edition links, and reading history',
        width: 1852,
        height: 1389,
    },
];

export default function Bookend() {
    useDocumentHead({
        title: 'Bookend',
        description:
            'A personal book-tracking app to log reads, organize books into lists, and explore reading stats.',
        ogImage: 'https://rsmb.tv/og/bookend.svg',
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Bookend',
        description: 'A personal book-tracking app to log reads, organize books into lists, and explore reading stats.',
        url: 'https://bookend.rsmb.tv',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        author: { '@type': 'Person', name: 'Robby Bryson', url: 'https://rsmb.tv' },
    });

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold text-zinc-100 mb-2">
                Bookend
            </h1>
            <p className="text-zinc-400 mb-6 text-sm">
                2026 · Next.js + PostgreSQL
            </p>

            <p className="text-zinc-300 leading-relaxed mb-6">
                A personal book-tracking app to log reads, organize books into
                lists, and explore reading stats. Integrates with{' '}
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
                for enrichment—covers, descriptions, author links, and more.
            </p>

            <div className="mb-8">
                <a
                    href="https://bookend.rsmb.tv"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
                >
                    Open Bookend →
                </a>
            </div>

            <ProjectScreenshotGallery screenshots={screenshots} />

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Features</h2>
            <ul className="space-y-1.5 text-zinc-400 text-sm mb-6 list-disc list-inside">
                <li>Search and add books via Google Books or Open Library</li>
                <li>Log reads with dates, ratings, and notes</li>
                <li>Organize books into custom lists and shelves</li>
                <li>Reading stats — books per year, pages read, genre breakdown</li>
                <li>
                    Auto-enrichment from multiple sources: covers, descriptions,
                    page counts, author bios
                </li>
                <li>Wikidata linking for author pages and canonical metadata</li>
                <li>Dockerized for easy self-hosting</li>
            </ul>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Tech Stack</h2>
            <div className="flex flex-wrap gap-2 mb-8">
                {[
                    'Next.js',
                    'TypeScript',
                    'Prisma',
                    'PostgreSQL',
                    'Tailwind CSS',
                    'Docker',
                ].map((t) => (
                    <span
                        key={t}
                        className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400"
                    >
                        {t}
                    </span>
                ))}
            </div>

            <div className="flex gap-4 text-sm">
                <a
                    href="https://github.com/robert-bryson/bookend"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 underline decoration-zinc-400/30 hover:decoration-zinc-400"
                >
                    Source on GitHub ↗
                </a>
            </div>
        </div>
    );
}
