import { TechBadges } from '../components/TechBadges';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { staticPageMetadata } from '../utils/pageMetadata';
import { projects } from '../content/projects';
import { ProjectChangelog } from '../components/ProjectChangelog';
import { ProjectScreenshotGallery, type ProjectScreenshot } from '../components/ProjectScreenshotGallery';
import { ProjectPageHeader } from '../components/ProjectPageHeader';

const PARC_URL = 'https://github.com/robert-bryson/parc';

const screenshots: ProjectScreenshot[] = [
    {
        src: '/images/parc/update-live-progress.webp',
        alt: 'parc update live progress output showing podcast feed progress, episode count, download speed, archived bytes, and ETA in a terminal',
        caption: 'Live update progress while archiving podcast episodes',
        width: 1713,
        height: 592,
        loading: 'eager',
    },
];

export default function Parc() {
    usePageMetadata(staticPageMetadata('/projects/parc'));

    const project = projects.find(p => p.slug === 'parc')!;

    return (
        <div className="max-w-[52rem]">
            <ProjectPageHeader
                title="parc"
                stack="Python CLI"
                description="A config-driven command line app for building a durable podcast archive over time. It manages feed subscriptions, scans for new episodes, downloads pending audio safely, and audits the local archive against its SQLite state."
                actions={[
                    { label: 'Source on GitHub →', href: PARC_URL, variant: 'primary', external: true },
                ]}
            />

            <ProjectScreenshotGallery screenshots={screenshots} />

            <h2 className="mb-3 text-lg font-medium text-zinc-100">Workflow</h2>
            <ul className="mb-6 list-inside list-disc space-y-1.5 text-sm text-zinc-400">
                <li>
                    Import feeds from OPML exports or discover RSS feeds from
                    podcast pages.
                </li>
                <li>
                    Scan feeds into SQLite to record new, downloaded, and failed
                    episode state.
                </li>
                <li>
                    Update the archive with resumable downloads, bounded retries,
                    and atomic file moves.
                </li>
                <li>
                    Analyze the archive for missing files, orphan audio,
                    duplicate enclosure URLs, and byte-size drift.
                </li>
            </ul>

            <h2 className="mb-3 text-lg font-medium text-zinc-100">Features</h2>
            <ul className="mb-6 list-inside list-disc space-y-1.5 text-sm text-zinc-400">
                <li>YAML config for feed aliases, archive roots, databases, and filename templates</li>
                <li>Conditional feed requests with stored ETag and Last-Modified headers</li>
                <li>Crash-safe partial downloads using <code>.part</code> files and HTTP range requests</li>
                <li>SHA-256 and byte-size fixity metadata for completed audio files</li>
                <li>Raw feed snapshots for provenance, with configurable retention and size limits</li>
                <li>Redacted progress logs that hide URL credentials, queries, and fragments</li>
            </ul>

            <h2 className="mb-3 text-lg font-medium text-zinc-100">Usage</h2>
            <pre className="mb-6 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-300">
                <code>{`# Create ~/.config/parc/config.yaml
parc config --init

# Add a feed or import subscriptions from a podcast app
parc feeds add https://feeds.example.com/show.xml --title "Example Show"
parc add PodcastAddict_export.opml

# Record outstanding episodes, archive them, then audit local state
parc scan
parc update
parc analyze`}</code>
            </pre>

            <h2 className="mb-3 text-lg font-medium text-zinc-100">Tech Stack</h2>
            <TechBadges tech={['Python', 'Click', 'Rich', 'SQLite', 'feedparser', 'Requests', 'PyYAML']} className="mb-8" />
            <ProjectChangelog entries={project.changelog ?? []} />
        </div>
    );
}
