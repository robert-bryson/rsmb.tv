import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { AUTHOR_PERSON, absoluteUrl } from '../utils/siteMetadata';
import { projects, formatProjectDate } from '../content/projects';
import { ProjectChangelog } from '../components/ProjectChangelog';

const screenshot = {
    src: '/images/parc/update-live-progress.webp',
    alt: 'parc update live progress output showing podcast feed progress, episode count, download speed, archived bytes, and ETA in a terminal',
    caption: 'Live update progress while archiving podcast episodes',
    width: 1713,
    height: 592,
};

export default function Parc() {
    const description =
        'A Python CLI for building a long-running archive of podcast feeds and episodes with resumable downloads, SQLite state, and local archive audits.';

    useDocumentHead({
        title: 'parc',
        description,
        ogImage: absoluteUrl('/og/parc.svg'),
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'parc',
        description,
        url: absoluteUrl('/projects/parc'),
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Cross-platform',
        softwareRequirements: 'Python 3.10+',
        screenshot: absoluteUrl(screenshot.src),
        author: AUTHOR_PERSON,
    });

    const project = projects.find(p => p.slug === 'parc')!;

    return (
        <div className="max-w-2xl">
            <h1 className="mb-2 text-2xl font-semibold text-zinc-100">
                parc
            </h1>
            <p className="mb-6 text-sm text-zinc-400">{formatProjectDate(project)} · Python CLI</p>

            <p className="mb-6 leading-relaxed text-zinc-300">
                A config-driven command line app for building a durable podcast
                archive over time. It manages feed subscriptions, scans for new
                episodes, downloads pending audio safely, and audits the local
                archive against its SQLite state.
            </p>

            <div className="mb-8 flex flex-wrap gap-3">
                <a
                    href="https://github.com/robert-bryson/parc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
                >
                    Source on GitHub →
                </a>
            </div>

            <figure className="mb-8">
                <img
                    src={screenshot.src}
                    alt={screenshot.alt}
                    className="w-full rounded-lg border border-zinc-800"
                    width={screenshot.width}
                    height={screenshot.height}
                    loading="eager"
                    decoding="async"
                />
                <figcaption className="mt-2 text-center text-xs leading-snug text-zinc-400">
                    {screenshot.caption}
                </figcaption>
            </figure>

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
            <div className="mb-8 flex flex-wrap gap-2">
                {['Python', 'Click', 'Rich', 'SQLite', 'feedparser', 'Requests', 'PyYAML'].map((t) => (
                    <span
                        key={t}
                        className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                    >
                        {t}
                    </span>
                ))}
            </div>
            <ProjectChangelog entries={project.changelog ?? []} />
        </div>
    );
}
