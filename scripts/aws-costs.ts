#!/usr/bin/env tsx
import {
    COST_BUDGET,
    fetchDetailedCosts,
    type DetailedCostData,
} from './dashboard/costModel.js';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const cyan = '\x1b[36m';
const white = '\x1b[97m';
const reset = '\x1b[0m';

interface Args {
    profile: string;
    region: string;
    mode: 'detail' | 'summary';
}

function parseArgs(argv: string[]): Args {
    const args: Args = {
        profile: process.env.AWS_PROFILE ?? 'rsmbtv-admin',
        region: process.env.AWS_REGION ?? 'us-east-1',
        mode: 'detail',
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--profile' && argv[i + 1]) {
            args.profile = argv[++i];
        } else if (arg === '--region' && argv[i + 1]) {
            args.region = argv[++i];
        } else if (arg === '--summary') {
            args.mode = 'summary';
        } else if (arg === '--detail') {
            args.mode = 'detail';
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
rsmb.tv AWS costs

Usage: tsx scripts/aws-costs.ts [--profile PROFILE] [--region REGION] [--detail|--summary]
`);
            process.exit(0);
        } else {
            throw new Error(`Unknown arg: ${arg}`);
        }
    }

    return args;
}

function fmt(amount: number): string {
    return `$${amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function hr(width = 60): void {
    console.log(`${dim}${'─'.repeat(width)}${reset}`);
}

function visibleLength(value: string): number {
    let length = 0;
    for (let index = 0; index < value.length; index++) {
        if (value.charCodeAt(index) === 0x1b && value[index + 1] === '[') {
            index += 2;
            while (index < value.length && value[index] !== 'm') index++;
            continue;
        }
        length++;
    }
    return length;
}

function padAnsi(value: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
    const padding = Math.max(0, width - visibleLength(value));
    if (align === 'right') return `${' '.repeat(padding)}${value}`;
    if (align === 'center') {
        const left = Math.floor(padding / 2);
        return `${' '.repeat(left)}${value}${' '.repeat(padding - left)}`;
    }
    return `${value}${' '.repeat(padding)}`;
}

function amountCell(amount: number, width: number, color = white): string {
    return amount > 0.001
        ? padAnsi(`${color}${fmt(amount)}${reset}`, width, 'right')
        : `${dim}${padAnsi('—', width, 'right')}${reset}`;
}

function renderSummary(data: DetailedCostData): void {
    const services = Object.entries(data.thisMonth.services)
        .sort(([, left], [, right]) => right - left);

    console.log(`\n${bold}💰 Cost — Current Month${reset}`);
    hr();

    if (services.length === 0) {
        console.log(`  ${dim}(no cost data available yet)${reset}`);
    } else {
        for (const [service, amount] of services) {
            console.log(`  ${service.padEnd(40)}  ${fmt(amount)}`);
        }
        console.log(`  ${''.padEnd(40)}  ──────`);
        console.log(`  ${'Total'.padEnd(40)}  ${cyan}${fmt(data.thisMonth.total)}${reset}`);
    }

    const forecast = data.forecastTotal;
    if (forecast != null) {
        const color = forecast > COST_BUDGET ? red : forecast > COST_BUDGET * 0.8 ? yellow : cyan;
        const remaining = data.forecastRemainingAmount ?? 0;
        console.log(
            `  ${dim}Forecast:${reset} ${color}${fmt(forecast)}${reset}`
            + ` ${dim}(${fmt(remaining)} remaining through ${data.windows.nextMonthStart})${reset}`,
        );
    } else {
        console.log(`  ${dim}Forecast:${reset} ${dim}—${reset}`);
    }
}

function renderDetail(data: DetailedCostData): void {
    const allServices = [...new Set([
        ...Object.keys(data.twoMonthsAgo.services),
        ...Object.keys(data.lastMonth.services),
        ...Object.keys(data.thisMonth.services),
    ])].sort();

    if (allServices.length > 0) {
        const serviceNameWidth = 32;
        const amountWidth = 10;
        const dataColumnCount = 4;
        const tableWidth = serviceNameWidth + (amountWidth + 2) * dataColumnCount + 4;

        console.log();
        console.log(`${bold}  Service Breakdown${reset}`);
        console.log(`  ${dim}${'─'.repeat(tableWidth)}${reset}`);
        console.log(
            `  ${dim}${'Service'.padEnd(serviceNameWidth)}`
            + `  ${data.windows.twoMonthsAgoLabel.padStart(amountWidth)}`
            + `  ${data.windows.lastMonthLabel.padStart(amountWidth)}`
            + `  ${'MTD'.padStart(amountWidth)}`
            + `  ${'Forecast'.padStart(amountWidth)}${reset}`,
        );
        console.log(`  ${dim}${'─'.repeat(tableWidth)}${reset}`);

        for (const service of allServices) {
            const twoMonthsAgoAmount = data.twoMonthsAgo.services[service] ?? 0;
            const lastMonthAmount = data.lastMonth.services[service] ?? 0;
            const thisMonthAmount = data.thisMonth.services[service] ?? 0;
            const forecastAmount = data.serviceForecasts[service] ?? 0;

            let trend = ' ';
            if (lastMonthAmount > 0.001 && forecastAmount > 0.001) {
                if (forecastAmount > lastMonthAmount * 1.1) trend = `${red}▲${reset}`;
                else if (forecastAmount < lastMonthAmount * 0.9) trend = `${green}▼${reset}`;
                else trend = `${dim}─${reset}`;
            } else if (forecastAmount > 0.001) {
                trend = `${yellow}●${reset}`;
            }

            const serviceDisplay = service.length > serviceNameWidth
                ? `${service.slice(0, serviceNameWidth - 2)}..`
                : service;

            console.log(
                `  ${serviceDisplay.padEnd(serviceNameWidth)}`
                + `  ${amountCell(twoMonthsAgoAmount, amountWidth)}`
                + `  ${amountCell(lastMonthAmount, amountWidth)}`
                + `  ${amountCell(thisMonthAmount, amountWidth, cyan)}`
                + `  ${amountCell(forecastAmount, amountWidth, yellow)}`
                + `  ${trend}`,
            );
        }

        console.log(`  ${dim}${'─'.repeat(tableWidth)}${reset}`);
        const forecastTotal = data.forecastTotal == null
            ? `${dim}${padAnsi('—', amountWidth, 'right')}${reset}`
            : padAnsi(`${yellow}${fmt(data.forecastTotal)}${reset}`, amountWidth, 'right');

        console.log(
            `  ${bold}${'Total'.padEnd(serviceNameWidth)}${reset}`
            + `  ${amountCell(data.twoMonthsAgo.total, amountWidth)}`
            + `  ${amountCell(data.lastMonth.total, amountWidth)}`
            + `  ${amountCell(data.thisMonth.total, amountWidth, cyan)}`
            + `  ${forecastTotal}`,
        );
    }

    const columnContentWidth = 15;
    const columnWidth = columnContentWidth + 2;
    const columnCount = 4;
    const innerWidth = columnWidth * columnCount + (columnCount - 1);

    console.log();
    console.log(`${dim}╭${'─'.repeat(innerWidth)}╮${reset}`);
    const title = '  AWS Cost Overview';
    console.log(`${dim}│${reset}${bold}${title}${' '.repeat(innerWidth - title.length)}${reset}${dim}│${reset}`);
    console.log(`${dim}├${Array.from({ length: columnCount }, () => '─'.repeat(columnWidth)).join('┬')}┤${reset}`);

    const headers = [data.windows.twoMonthsAgoLabel, data.windows.lastMonthLabel, 'MTD', 'Forecast'];
    console.log(`${dim}│${reset}${headers.map(header => ` ${dim}${padAnsi(header, columnContentWidth, 'center')}${reset} `).join(`${dim}│${reset}`)}${dim}│${reset}`);

    const values = [
        `${white}${fmt(data.twoMonthsAgo.total)}${reset}`,
        `${white}${fmt(data.lastMonth.total)}${reset}`,
        `${cyan}${fmt(data.thisMonth.total)}${reset}`,
        data.forecastTotal == null ? `${dim}—${reset}` : `${yellow}${fmt(data.forecastTotal)}${reset}`,
    ];
    console.log(`${dim}│${reset}${values.map(value => ` ${padAnsi(value, columnContentWidth, 'center')} `).join(`${dim}│${reset}`)}${dim}│${reset}`);

    if (data.lastMonth.total > 0 && data.forecastTotal != null) {
        const delta = data.forecastTotal - data.lastMonth.total;
        const pct = (delta / data.lastMonth.total) * 100;
        const arrow = delta > 0
            ? `${red}▲ +${fmt(delta)} (${pct.toFixed(0)}%)${reset}`
            : delta < 0
                ? `${green}▼ -${fmt(Math.abs(delta))} (${Math.abs(pct).toFixed(0)}%)${reset}`
                : `${dim}— no change${reset}`;
        const deltaRow = `  Forecast vs ${data.windows.lastMonthLabel}: ${arrow}`;
        console.log(`${dim}├${'─'.repeat(innerWidth)}┤${reset}`);
        console.log(`${dim}│${reset}${deltaRow}${' '.repeat(Math.max(0, innerWidth - visibleLength(deltaRow)))}${dim}│${reset}`);
    }

    if (data.forecastRemainingAmount != null) {
        console.log(`${dim}├${'─'.repeat(innerWidth)}┤${reset}`);
        const note = `  Includes ${fmt(data.forecastRemainingAmount)} daily forecast remaining`;
        console.log(`${dim}│${reset}${note}${' '.repeat(Math.max(0, innerWidth - note.length))}${dim}│${reset}`);
    }

    console.log(`${dim}╰${'─'.repeat(innerWidth)}╯${reset}`);
    console.log();
}

try {
    const args = parseArgs(process.argv.slice(2));
    const data = await fetchDetailedCosts({ profile: args.profile, region: args.region });

    if (args.mode === 'summary') renderSummary(data);
    else renderDetail(data);
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  ${red}(cost data unavailable)${reset} ${dim}${message}${reset}`);
    process.exitCode = 1;
}
