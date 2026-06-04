import { ProjectScreenshotGallery, type ProjectScreenshot } from '../components/ProjectScreenshotGallery';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { useJsonLd } from '../hooks/useJsonLd';
import { AUTHOR_PERSON, absoluteUrl } from '../utils/siteMetadata';
import { projects, formatProjectDate } from '../content/projects';
import { ProjectChangelog } from '../components/ProjectChangelog';

const screenshots: ProjectScreenshot[] = [
    {
        src: '/images/status-dashboard/status-dashboard-calm.webp',
        alt: 'Status Dashboard calm view showing all-OK summary for health, alarms, builds, GitHub, cost, and AWS resources',
        caption: 'Calm view — all-green summary across health checks, CloudWatch alarms, builds, and AWS resource usage',
        width: 872,
        height: 610,
        loading: 'eager',
    },
    {
        src: '/images/status-dashboard/status-dashboard-builds.webp',
        alt: 'Status Dashboard detail view showing build panel with AWS Amplify and GitHub Actions workflow run results for multiple projects',
        caption: 'Builds panel — Amplify deployments and GitHub Actions runs across all projects, with build numbers, branches, and elapsed time',
        width: 869,
        height: 625,
    },
    {
        src: '/images/status-dashboard/status-dashboard-resources.webp',
        alt: 'Status Dashboard detail view showing AWS resource panel with S3 bucket sizes, CloudFront distribution traffic, Lambda invocations, and cost forecast',
        caption: 'Resources panel — S3 storage by bucket, CloudFront request rates across distributions, Lambda invocation rates and p50 latency, and MTD cost forecast',
        width: 877,
        height: 616,
    },
];

export default function StatusDashboard() {
    const description =
        'A live terminal monitoring dashboard for AWS infrastructure, GitHub CI builds, and site health — rendered with Ink.';

    useDocumentHead({
        title: 'Status Dashboard',
        description,
        ogImage: absoluteUrl('/og/status-dashboard.svg'),
    });

    useJsonLd({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Status Dashboard',
        description,
        url: absoluteUrl('/projects/status-dashboard'),
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Cross-platform',
        author: AUTHOR_PERSON,
    });

    const project = projects.find(p => p.slug === 'status-dashboard')!;

    return (
        <div className="max-w-2xl">
            <h1 className="mb-2 text-2xl font-semibold text-zinc-100">
                Status Dashboard
            </h1>
            <p className="mb-6 text-sm text-zinc-400">
                {formatProjectDate(project)} · TypeScript + Ink
            </p>

            <p className="mb-6 leading-relaxed text-zinc-300">
                A live terminal monitoring dashboard built into this repo for
                watching over AWS infrastructure, GitHub CI, and site health at a
                glance. It renders multiple data panels side-by-side in the
                terminal using{' '}
                <a
                    href="https://github.com/vadimdemedes/ink"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 underline decoration-violet-400/30 hover:decoration-violet-400"
                >
                    Ink
                </a>{' '}
                — React for the terminal — and polls AWS and GitHub APIs on
                configurable intervals.
            </p>

            <ProjectScreenshotGallery screenshots={screenshots} />

            <h2 className="mb-3 text-lg font-medium text-zinc-100">Panels</h2>
            <ul className="mb-6 list-inside list-disc space-y-1.5 text-sm text-zinc-400">
                <li>
                    <span className="font-medium text-zinc-200">Health</span> —
                    Route53 health check status with HTTP fallback, latency
                    tracking, and time-series sparklines
                </li>
                <li>
                    <span className="font-medium text-zinc-200">Alarms</span> —
                    CloudWatch alarm states across all monitored resources
                </li>
                <li>
                    <span className="font-medium text-zinc-200">Builds</span> —
                    Amplify deployment statuses and GitHub Actions workflow runs,
                    with stale-run detection
                </li>
                <li>
                    <span className="font-medium text-zinc-200">Costs</span> —
                    Month-to-date AWS spend with a daily-granularity forecast for
                    the rest of the month
                </li>
                <li>
                    <span className="font-medium text-zinc-200">Resources</span> —
                    S3 storage by bucket, CloudFront request rates, and Lambda
                    invocation rates with p50 latency
                </li>
                <li>
                    <span className="font-medium text-zinc-200">External</span> —
                    Third-party dependency health grouped by status page (AWS,
                    GitHub, Cloudflare, etc.)
                </li>
                <li>
                    <span className="font-medium text-zinc-200">GitHub</span> —
                    Open pull requests and issues across monitored repos
                </li>
                <li>
                    <span className="font-medium text-zinc-200">Incidents</span> —
                    Auto-detected incident log with open and resolved summaries
                </li>
                <li>
                    <span className="font-medium text-zinc-200">Events</span> —
                    Timestamped event log of API calls and state changes
                </li>
            </ul>

            <h2 className="mb-3 text-lg font-medium text-zinc-100">Usage</h2>
            <pre className="mb-6 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-300">
                <code>{`tsx scripts/aws-watch.tsx [options]

Options:
  --profile <name>    AWS profile (default: $AWS_PROFILE)
  --region <region>   AWS region  (default: us-east-1)
  --interval <secs>   Base refresh interval in seconds (default: 60)

Environment variables:
  GITHUB_TOKEN              GitHub personal access token
  RSMBTV_AMPLIFY_APP_ID     Amplify app ID override
  BOOKEND_HEALTH_CHECK_ID   Route53 health check ID override`}</code>
            </pre>

            <h2 className="mb-3 text-lg font-medium text-zinc-100">Keyboard Controls</h2>
            <ul className="mb-6 list-inside list-disc space-y-1.5 text-sm text-zinc-400">
                <li><code className="text-zinc-300">q</code> — quit</li>
                <li><code className="text-zinc-300">h</code> — toggle detail view</li>
                <li><code className="text-zinc-300">e</code> — clear event log</li>
                <li><code className="text-zinc-300">j / k</code> — scroll down / up</li>
            </ul>

            <h2 className="mb-3 text-lg font-medium text-zinc-100">Tech Stack</h2>
            <div className="mb-8 flex flex-wrap gap-2">
                {['TypeScript', 'React (Ink)', 'AWS SDK v3', 'CloudWatch', 'Route53', 'GitHub API'].map((t) => (
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
