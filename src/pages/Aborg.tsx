import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';

export default function Aborg() {
    useDocumentHead({
        title: 'aborg',
        description:
            'A CLI tool to scan, organize, and manage audiobook file collections into an Audiobookshelf-compatible directory structure.',
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'aborg',
        description:
            'A CLI tool to scan, organize, and manage audiobook file collections into an Audiobookshelf-compatible directory structure.',
        url: 'https://rsmb.tv/projects/aborg',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Cross-platform',
        author: { '@type': 'Person', name: 'Robby Bryson', url: 'https://rsmb.tv' },
    });

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold text-zinc-100 mb-2">
                aborg
            </h1>
            <p className="text-zinc-400 mb-6 text-sm">2026 · Python CLI</p>

            <p className="text-zinc-300 leading-relaxed mb-6">
                A CLI tool to scan, organize, and manage audiobook file
                collections. Outputs an{' '}
                <a
                    href="https://www.audiobookshelf.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 underline decoration-violet-400/30 hover:decoration-violet-400"
                >
                    Audiobookshelf
                </a>
                -compatible directory structure with smart filename parsing,
                metadata extraction, and{' '}
                <a
                    href="https://www.overdrive.com/apps/libby"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 underline decoration-violet-400/30 hover:decoration-violet-400"
                >
                    Libby/OverDrive
                </a>{' '}
                integration.
            </p>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">
                Directory Structure
            </h2>
            <pre className="bg-zinc-900 rounded-lg p-4 text-sm text-zinc-300 overflow-x-auto mb-6">
                <code>{`/mnt/audiobooks/
├── Goodkind, Terry/
│   └── Sword of Truth/
│       ├── Vol 1 - 1994 - Wizards First Rule {Sam Tsoutsouvas}/
│       └── Vol 2 - 1995 - Stone of Tears/
├── Levy, Steven/
│   └── Hackers - Heroes of the Computer Revolution {Mike Chamberlain}/
└── Orwell, George/
    └── 1945 - Animal Farm/`}</code>
            </pre>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Commands</h2>
            <ul className="space-y-1.5 text-zinc-400 text-sm mb-6 list-disc list-inside">
                <li>
                    <span className="text-zinc-200 font-medium">scan</span> — discover
                    audiobook files across multiple source directories
                </li>
                <li>
                    <span className="text-zinc-200 font-medium">org</span> — move or
                    copy files into a clean Author / Series / Title hierarchy
                </li>
                <li>
                    <span className="text-zinc-200 font-medium">fetch</span> — download
                    audiobook loans from Libby/OverDrive and auto-organize
                </li>
                <li>
                    <span className="text-zinc-200 font-medium">analyze</span> — audit a
                    collection for duplicates, missing metadata, and naming issues
                </li>
                <li>
                    <span className="text-zinc-200 font-medium">parse</span> — test how
                    a filename will be parsed before running
                </li>
                <li>
                    <span className="text-zinc-200 font-medium">rename</span> — batch-rename
                    folders to match Audiobookshelf naming conventions
                </li>
                <li>
                    <span className="text-zinc-200 font-medium">undo</span> — revert the
                    last organize operation via a move log
                </li>
            </ul>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Features</h2>
            <ul className="space-y-1.5 text-zinc-400 text-sm mb-6 list-disc list-inside">
                <li>Handles zip archives, .m4b, .mp3, and loose audio folders</li>
                <li>Reads ID3/audio tags via Mutagen and merges with filename parsing</li>
                <li>Auto-extracts archives at the destination (with zip-slip protection)</li>
                <li>Every destructive command supports --dry-run</li>
                <li>Fingerprint-based caching to speed up repeated scans</li>
                <li>YAML config for source dirs, destination, patterns, and more</li>
            </ul>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Usage</h2>
            <pre className="bg-zinc-900 rounded-lg p-4 text-sm text-zinc-300 overflow-x-auto mb-6">
                <code>{`# Preview what would happen
aborg org --dry-run

# Organize for real
aborg org

# Download and auto-organize latest Libby loan
aborg fetch --latest 1 --organize

# Audit your collection
aborg analyze --path /mnt/nas/audiobooks`}</code>
            </pre>

            <h2 className="text-lg font-medium text-zinc-100 mb-3">Tech Stack</h2>
            <div className="flex flex-wrap gap-2 mb-8">
                {['Python', 'Click', 'Mutagen', 'YAML', 'odmpy'].map((t) => (
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
                    href="https://github.com/robert-bryson/aborg"
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
