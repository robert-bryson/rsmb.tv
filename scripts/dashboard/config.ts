import { fromIni } from '@aws-sdk/credential-providers';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkflowConfig {
    name: string;
    file: string;
    /** If the last successful run is older than this, flag it as stale. */
    staleThresholdHours?: number;
}

export interface ProjectConfig {
    name: string;
    domain: string;
    kind: 'amplify' | 'lambda-cloudfront' | 'github-only';
    amplifyAppId?: string;
    githubRepo?: string;
    healthCheckId?: string;
    healthUrl?: string;
    workflows?: WorkflowConfig[];
}

export interface ExternalSite {
    name: string;
}

export interface SiteGroup {
    id: string;
    label: string;
    statusPageUrl: string;
    sites: ExternalSite[];
}

export type DisplayMode = 'calm' | 'alert' | 'detail';

export interface DashboardConfig {
    profile: string;
    region: string;
    timeZone: string;
    githubToken: string | undefined;
    projects: ProjectConfig[];
    githubRepos: string[];
    externalGroups: SiteGroup[];
    intervals: {
        health: number;
        alarms: number;
        builds: number;
        costs: number;
        external: number;
        github: number;
    };
}

// ─── Projects to monitor ─────────────────────────────────────────────────────
// Add, remove, or edit entries here. githubRepos is derived automatically.
// amplifyAppId / healthCheckId can be set inline or via env vars (see below).

const projects: ProjectConfig[] = [
    {
        name: 'bookend',
        domain: 'bookend.rsmb.tv',
        kind: 'lambda-cloudfront',
        githubRepo: 'robert-bryson/bookend',
        healthUrl: 'https://bookend.rsmb.tv/api/health',
    },
    {
        name: 'data',
        domain: 'data.rsmb.tv',
        kind: 'lambda-cloudfront',
        healthUrl: 'https://data.rsmb.tv/',
    },
    {
        name: 'route2gpx',
        domain: 'route2gpx.rsmb.tv',
        kind: 'amplify',
        githubRepo: 'robert-bryson/route2gpx',
        healthUrl: 'https://route2gpx.rsmb.tv/',
    },
    {
        name: 'rsmb.tv',
        domain: 'www.rsmb.tv',
        kind: 'amplify',
        githubRepo: 'robert-bryson/rsmb.tv',
        healthUrl: 'https://www.rsmb.tv/',
        workflows: [
            { name: 'Sync Flights', file: 'sync-flights.yml', staleThresholdHours: 36 },
            { name: 'Sync Temps', file: 'sync-temperatures.yml', staleThresholdHours: 36 },
        ],
    },
    {
        name: 'through-routes',
        domain: 'through-routes.rsmb.tv',
        kind: 'lambda-cloudfront',
        githubRepo: 'robert-bryson/through-routes',
        healthUrl: 'https://through-routes.rsmb.tv/api/health',
    },
    {
        name: 'aborg',
        domain: '',
        kind: 'github-only',
        githubRepo: 'robert-bryson/aborg',
        workflows: [
            { name: 'CI', file: 'ci.yml' },
        ],
    },
    {
        name: 'anki-artisan',
        domain: '',
        kind: 'github-only',
        githubRepo: 'robert-bryson/anki-artisan',
    },
    {
        name: 'kin-cal',
        domain: '',
        kind: 'github-only',
        githubRepo: 'robert-bryson/kin-cal',
    },
];

// ─── External status pages to monitor ────────────────────────────────────────

const externalGroups: SiteGroup[] = [
    {
        id: 'egp',
        label: 'EGP',
        statusPageUrl: 'https://uptime.com/statuspage/egp',
        sites: [
            { name: 'ATBDirectory' },
            { name: 'CFETS' },
            { name: 'EGP Website' },
            { name: 'FLIGHT' },
            { name: 'SmokeJumper' },
            { name: 'WildfireSA' },
            { name: 'WildfireSA Advanced' },
            { name: 'WPSAPS' },
        ],
    },
];

// ─── Interval defaults (seconds) ────────────────────────────────────────────
// Each panel has a minimum floor to avoid hammering APIs.

const INTERVAL_FLOORS: Record<keyof DashboardConfig['intervals'], { min: number; multiplier: number }> = {
    health: { min: 30, multiplier: 1 },
    alarms: { min: 60, multiplier: 1 },
    builds: { min: 60, multiplier: 1 },
    costs: { min: 300, multiplier: 5 },
    external: { min: 60, multiplier: 1 },
    github: { min: 120, multiplier: 2 },
};

// ─── Env-var overrides for AWS resource IDs ──────────────────────────────────
// Set AMPLIFY_APP_IDS="rsmb.tv=abc123,route2gpx=def456" in .env.local to
// override amplifyAppId per project. Same format for HEALTH_CHECK_IDS.
// Inline values on the project objects above take precedence.

function parseIdMap(envVar: string | undefined): Map<string, string> {
    const map = new Map<string, string>();
    if (!envVar) return map;
    for (const pair of envVar.split(',')) {
        const [key, value] = pair.split('=', 2);
        if (key && value) map.set(key.trim(), value.trim());
    }
    return map;
}

function applyEnvOverrides(list: ProjectConfig[]): ProjectConfig[] {
    const amplifyIds = parseIdMap(process.env.AMPLIFY_APP_IDS);
    const healthCheckIds = parseIdMap(process.env.HEALTH_CHECK_IDS);

    for (const p of list) {
        if (!p.amplifyAppId && amplifyIds.has(p.name)) p.amplifyAppId = amplifyIds.get(p.name);
        if (!p.healthCheckId && healthCheckIds.has(p.name)) p.healthCheckId = healthCheckIds.get(p.name);
    }
    return list;
}

// ─── Config factory ──────────────────────────────────────────────────────────

export function createConfig(flags: {
    profile?: string;
    region?: string;
    interval?: number;
    timeZone?: string;
}): DashboardConfig {
    const baseInterval = flags.interval ?? 60;
    const resolvedProjects = applyEnvOverrides(projects);

    const intervals = Object.fromEntries(
        Object.entries(INTERVAL_FLOORS).map(([key, { min, multiplier }]) => [
            key,
            Math.max(min, baseInterval * multiplier),
        ]),
    ) as DashboardConfig['intervals'];

    return {
        profile: flags.profile ?? process.env.AWS_PROFILE ?? 'rsmbtv-admin',
        region: flags.region ?? process.env.AWS_REGION ?? 'us-east-1',
        timeZone: flags.timeZone ?? process.env.DASHBOARD_TIMEZONE ?? 'America/Chicago',
        githubToken: process.env.GITHUB_TOKEN,
        projects: resolvedProjects,
        githubRepos: resolvedProjects
            .map(p => p.githubRepo)
            .filter((r): r is string => r !== undefined),
        externalGroups,
        intervals,
    };
}

// ─── Utilities (used by panels) ──────────────────────────────────────────────

export function awsCredentials(profile: string) {
    return fromIni({ profile });
}

/** OSC 8 terminal hyperlink (clickable in modern terminals) */
export function link(url: string, text: string): string {
    return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}
