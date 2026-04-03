#!/usr/bin/env tsx
import { execSync } from 'node:child_process';
import React from 'react';
import { render } from 'ink';
import { App } from './dashboard/App.js';
import { createConfig } from './dashboard/config.js';

// Auto-detect timezone in WSL (where system TZ often defaults to UTC)
if (!process.env.TZ) {
    try {
        const winTz = execSync(
            'powershell.exe -NoProfile -NonInteractive -Command "[TimeZoneInfo]::Local.Id"',
            { timeout: 5000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
        ).trim();
        const WINDOWS_TO_IANA: Record<string, string> = {
            'Eastern Standard Time': 'America/New_York',
            'Central Standard Time': 'America/Chicago',
            'Mountain Standard Time': 'America/Denver',
            'Pacific Standard Time': 'America/Los_Angeles',
            'Alaska Standard Time': 'America/Anchorage',
            'Hawaiian Standard Time': 'Pacific/Honolulu',
            'US Eastern Standard Time': 'America/Indiana/Indianapolis',
            'US Mountain Standard Time': 'America/Phoenix',
            'Atlantic Standard Time': 'America/Halifax',
            'GMT Standard Time': 'Europe/London',
            'Central European Standard Time': 'Europe/Berlin',
        };
        if (WINDOWS_TO_IANA[winTz]) process.env.TZ = WINDOWS_TO_IANA[winTz];
    } catch {
        // Not in WSL or powershell unavailable — use system default
    }
}

function parseArgs(args: string[]) {
    const flags: Record<string, string> = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--profile' && args[i + 1]) {
            flags.profile = args[++i];
        } else if (arg === '--region' && args[i + 1]) {
            flags.region = args[++i];
        } else if (arg === '--interval' && args[i + 1]) {
            flags.interval = args[++i];
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
rsmb.tv Watch Dashboard — Live terminal monitoring

Usage: tsx scripts/aws-watch.tsx [options]

Options:
  --profile <name>    AWS profile (default: rsmbtv-admin or $AWS_PROFILE)
  --region <region>    AWS region (default: us-east-1 or $AWS_REGION)
  --interval <secs>   Base refresh interval in seconds (default: 60)
  -h, --help          Show this help

Environment variables:
  AWS_PROFILE               AWS profile name
  AWS_REGION                AWS region
  GITHUB_TOKEN              GitHub personal access token (builds, PRs, issues)
  RSMBTV_AMPLIFY_APP_ID     Override rsmb.tv Amplify app ID
  ROUTE2GPX_AMPLIFY_APP_ID  Override route2gpx Amplify app ID
  RSMBTV_HEALTH_CHECK_ID    Override rsmb.tv Route53 health check ID
  BOOKEND_HEALTH_CHECK_ID   Override Bookend Route53 health check ID

Keyboard:
  q    Quit
  h    Toggle alarm details
`);
            process.exit(0);
        }
    }
    return flags;
}

const flags = parseArgs(process.argv.slice(2));

const config = createConfig({
    profile: flags.profile,
    region: flags.region,
    interval: flags.interval ? parseInt(flags.interval, 10) : undefined,
});

render(React.createElement(App, { config }));
