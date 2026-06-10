import { ProjectScreenshotGallery, type ProjectScreenshot } from '../components/ProjectScreenshotGallery';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { AUTHOR_PERSON, absoluteUrl } from '../utils/siteMetadata';
import { projects } from '../content/projects';
import { ProjectChangelog } from '../components/ProjectChangelog';

const screenshots: ProjectScreenshot[] = [
    {
        src: '/images/anki-artisan/anki-artisan-visual-id.webp',
        alt: 'Anki card showing six iNaturalist plant photos above the prompt "What order is this?"',
        caption: 'Visual ID - six iNaturalist photos; identify the order (Rosales)',
        width: 1079,
        height: 1896,
        loading: 'eager',
    },
    {
        src: '/images/anki-artisan/anki-artisan-nomenclature-sci-common.webp',
        alt: 'Anki card for genus Cercis showing the common name "redbuds" with six iNaturalist reference photos',
        caption: 'Nomenclature (scientific to common) - genus Cercis = redbuds',
        width: 1079,
        height: 1703,
    },
    {
        src: '/images/anki-artisan/anki-artisan-nomenclature-common-sci.webp',
        alt: 'Anki card for Black-necked Stilt showing the scientific name Himantopus mexicanus with a reference photo',
        caption: 'Nomenclature (common to scientific) - Black-necked Stilt = Himantopus mexicanus',
        width: 1079,
        height: 1671,
    },
];

export default function AnkiArtisan() {
    const description =
        'A CLI tool that generates Anki flashcard decks from iNaturalist observations and eBird region data.';

    useDocumentHead({
        title: 'Anki Artisan',
        description,
        ogImage: absoluteUrl('/og/anki-artisan.svg'),
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Anki Artisan',
        description,
        url: absoluteUrl('/projects/anki-artisan'),
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Cross-platform',
        author: AUTHOR_PERSON,
    });

    const project = projects.find(p => p.slug === 'anki-artisan')!;

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold text-zinc-100 mb-2">
                Anki Artisan
            </h1>
            <p className="text-zinc-400 mb-6 text-sm">Python CLI</p>

            <p className="text-zinc-300 leading-relaxed mb-6">
                A CLI tool that generates{' '}
                <a
                    href="https://apps.ankiweb.net/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 underline decoration-violet-400/30 hover:decoration-violet-400"
                >
                    Anki
                </a>{' '}
                flashcard decks from{' '}
                <a
                    href="https://www.inaturalist.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 underline decoration-violet-400/30 hover:decoration-violet-400"
                >
                    iNaturalist
                </a>{' '}
                observations and{' '}
                <a
                    href="https://ebird.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 underline decoration-violet-400/30 hover:decoration-violet-400"
                >
                    eBird
                </a>{' '}
                region data. It fetches species photos, audio, and taxonomy to
                automatically build study-ready decks for learning birds, plants, and
                other wildlife.
            </p>

            <div className="mb-8 flex flex-wrap gap-3">
                <a
                    href="https://github.com/robert-bryson/anki-artisan"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
                >
                    Source on GitHub →
                </a>
            </div>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Card Types</h2>
            <ul className="space-y-2 text-zinc-400 text-sm mb-6">
                <li>
                    <span className="text-zinc-200 font-medium">Visual ID</span> — photo
                    → identify the species
                </li>
                <li>
                    <span className="text-zinc-200 font-medium">Nomenclature</span> —
                    common name ↔ scientific name (bidirectional)
                </li>
                <li>
                    <span className="text-zinc-200 font-medium">Sound ID</span> — audio →
                    identify the species
                </li>
                <li>
                    <span className="text-zinc-200 font-medium">Confusion Species</span>{' '}
                    — side-by-side comparison of lookalikes
                </li>
            </ul>

            <ProjectScreenshotGallery screenshots={screenshots} layout="grid" />

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Features</h2>
            <ul className="space-y-1.5 text-zinc-400 text-sm mb-6 list-disc list-inside">
                <li>Pulls species from iNaturalist observations and/or eBird region checklists</li>
                <li>Fetches taxon photos, audio, and full taxonomy from iNaturalist</li>
                <li>Frequency-based filtering via eBird to drop vagrants and rarities</li>
                <li>Interactive region search to add eBird regions by name</li>
                <li>Higher-taxa cards for families, orders, etc. alongside species</li>
                <li>SQLite-backed caching for API responses, taxa, and media</li>
                <li>Change tracking — knows which cards are new, updated, or unchanged</li>
            </ul>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Usage</h2>
            <pre className="bg-zinc-900 rounded-lg p-4 text-sm text-zinc-300 overflow-x-auto mb-6">
                <code>{`# Interactive setup
anki-artisan init

# Build a deck
anki-artisan build

# Add an eBird region by name
anki-artisan ebird add-region "Missouri"`}</code>
            </pre>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Tech Stack</h2>
            <div className="flex flex-wrap gap-2 mb-8">
                {['Python', 'Click', 'genanki', 'pyinaturalist', 'eBird API', 'SQLite'].map(
                    (t) => (
                        <span
                            key={t}
                            className="px-2 py-0.5 text-xs rounded-full bg-zinc-800 text-zinc-400"
                        >
                            {t}
                        </span>
                    ),
                )}
            </div>
            <ProjectChangelog entries={project.changelog ?? []} />
        </div>
    );
}
