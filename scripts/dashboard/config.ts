import { fromIni } from '@aws-sdk/credential-providers';

export interface WorkflowConfig {
    name: string;
    file: string;
}

export interface ProjectConfig {
    name: string;
    domain: string;
    kind: 'amplify' | 'lambda-cloudfront';
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
    githubToken: string | undefined;
    projects: ProjectConfig[];
    externalGroups: SiteGroup[];
    intervals: {
        health: number;
        alarms: number;
        builds: number;
        costs: number;
        external: number;
    };
}

/**
 * Parse a "key=value,key=value" env var into a Map.
 * e.g. "rsmb.tv=d38ki8k4lanh8s,route2gpx=d3cg0fxhpxa01e"
 */
function parseIdMap(envVar: string | undefined): Map<string, string> {
    const map = new Map<string, string>();
    if (!envVar) return map;
    for (const pair of envVar.split(',')) {
        const [key, value] = pair.split('=', 2);
        if (key && value) map.set(key.trim(), value.trim());
    }
    return map;
}

function buildProjects(): ProjectConfig[] {
    const amplifyIds = parseIdMap(process.env.AMPLIFY_APP_IDS);
    const healthCheckIds = parseIdMap(process.env.HEALTH_CHECK_IDS);

    const projects: ProjectConfig[] = [
        {
            name: 'rsmb.tv',
            domain: 'www.rsmb.tv',
            kind: 'amplify',
            githubRepo: 'robert-bryson/rsmb.tv',
            healthUrl: 'https://www.rsmb.tv/',
            workflows: [
                { name: 'Sync Flights', file: 'sync-flights.yml' },
                { name: 'Sync Temps', file: 'sync-temperatures.yml' },
            ],
        },
        {
            name: 'bookend',
            domain: 'bookend.rsmb.tv',
            kind: 'lambda-cloudfront',
            githubRepo: 'robert-bryson/bookend',
            healthUrl: 'https://bookend.rsmb.tv/api/health',
        },
        {
            name: 'through-routes',
            domain: 'through-routes.rsmb.tv',
            kind: 'lambda-cloudfront',
            githubRepo: 'robert-bryson/through-routes',
            healthUrl: 'https://through-routes.rsmb.tv/api/health',
        },
        {
            name: 'route2gpx',
            domain: 'route2gpx.rsmb.tv',
            kind: 'amplify',
            githubRepo: 'robert-bryson/route2gpx',
            healthUrl: 'https://route2gpx.rsmb.tv/',
        },
    ];

    for (const p of projects) {
        if (amplifyIds.has(p.name)) p.amplifyAppId = amplifyIds.get(p.name);
        if (healthCheckIds.has(p.name)) p.healthCheckId = healthCheckIds.get(p.name);
    }

    return projects;
}

export const PROJECTS: ProjectConfig[] = buildProjects();

function buildExternalGroups(): SiteGroup[] {
    return [
        {
            id: 'egp',
            label: 'EGP',
            statusPageUrl: 'https://uptime.com/statuspage/egp',
            sites: [
                { name: 'EGP Website' },
                { name: 'WildfireSA' },
                { name: 'WildfireSA Advanced' },
                { name: 'ATBDirectory' },
                { name: 'FLIGHT' },
                { name: 'SmokeJumper' },
                { name: 'CFETS' },
                { name: 'WPSAPS' },
            ],
        },
    ];
}

export function createConfig(flags: {
    profile?: string;
    region?: string;
    interval?: number;
}): DashboardConfig {
    const baseInterval = flags.interval ?? 60;
    return {
        profile: flags.profile ?? process.env.AWS_PROFILE ?? 'rsmbtv-admin',
        region: flags.region ?? process.env.AWS_REGION ?? 'us-east-1',
        githubToken: process.env.GITHUB_TOKEN,
        projects: PROJECTS,
        externalGroups: buildExternalGroups(),
        intervals: {
            health: Math.max(30, baseInterval),
            alarms: Math.max(60, baseInterval),
            builds: Math.max(60, baseInterval),
            costs: Math.max(300, baseInterval * 5),
            external: Math.max(60, baseInterval),
        },
    };
}

export function awsCredentials(profile: string) {
    return fromIni({ profile });
}

/** OSC 8 terminal hyperlink (clickable in modern terminals) */
export function link(url: string, text: string): string {
    return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}
