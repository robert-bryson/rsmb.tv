import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';

export default function AnkiArtisan() {
    useDocumentHead({
        title: 'Anki Artisan',
        description:
            'A CLI tool that generates Anki flashcard decks from iNaturalist observations and eBird region data.',
        ogImage: 'https://rsmb.tv/og/anki-artisan.svg',
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Anki Artisan',
        description: 'A CLI tool that generates Anki flashcard decks from iNaturalist observations and eBird region data.',
        url: 'https://rsmb.tv/projects/anki-artisan',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Cross-platform',
        author: { '@type': 'Person', name: 'Robby Bryson', url: 'https://rsmb.tv' },
    });

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold text-zinc-100 mb-2">
                Anki Artisan
            </h1>
            <p className="text-zinc-400 mb-6 text-sm">2026 · Python CLI</p>

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

            <div className="flex gap-4 text-sm">
                <a
                    href="https://github.com/robert-bryson/anki-artisan"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 underline decoration-violet-400/30 hover:decoration-violet-400"
                >
                    Source on GitHub ↗
                </a>
            </div>
        </div>
    );
}
