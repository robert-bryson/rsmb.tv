import { ProjectPageHeader } from '../components/ProjectPageHeader';
import { TechBadges } from '../components/TechBadges';
import { ProjectScreenshotGallery, type ProjectScreenshot } from '../components/ProjectScreenshotGallery';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';
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
    usePageMetadata(staticPageMetadata('/projects/anki-artisan'));

    const project = projects.find(p => p.slug === 'anki-artisan')!;

    return (
        <div className="max-w-[52rem]">
            <ProjectPageHeader
                title="Anki Artisan"
                stack="Python CLI"
                description={(
                    <>
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
                    </>
                )}
                actions={[
                    { label: 'Source on GitHub →', href: 'https://github.com/robert-bryson/anki-artisan', external: true },
                ]}
            />

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
            <TechBadges tech={['Python', 'Click', 'genanki', 'pyinaturalist', 'eBird API', 'SQLite']} className="mb-8" />
            <ProjectChangelog entries={project.changelog ?? []} />
        </div>
    );
}
