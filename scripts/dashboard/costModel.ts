import {
    CostExplorerClient,
    GetCostAndUsageCommand,
    GetCostForecastCommand,
    type GetCostAndUsageCommandInput,
    type GetCostAndUsageCommandOutput,
    type GetCostForecastCommandInput,
    type GetCostForecastCommandOutput,
} from '@aws-sdk/client-cost-explorer';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { awsCredentials, type DashboardConfig } from './config.js';

export const COST_BUDGET = 50;
export const COST_CACHE_VERSION = 2;
export const COST_CACHE_DIR = join(tmpdir(), 'rsmb-dashboard');
export const COST_CACHE_FILE = join(COST_CACHE_DIR, 'cost-cache.json');
export const USAGE_COST_METRIC = 'BlendedCost';
export const FORECAST_COST_METRIC = 'BLENDED_COST';

const MIN_COST_AMOUNT = 0.001;

export interface CostData {
    lastMonth: number | null;
    lastMonthLabel: string;
    mtdAmount: number | null;
    forecastAmount: number | null;
    forecastRemainingAmount: number | null;
}

interface CostCache {
    version: number;
    date: string;
    data: CostData;
}

export interface ServiceCostTotals {
    services: Record<string, number>;
    total: number;
}

export interface CostWindows {
    today: string;
    monthStart: string;
    nextMonthStart: string;
    lastMonthStart: string;
    twoMonthsAgoStart: string;
    thisMonthLabel: string;
    lastMonthLabel: string;
    lastMonthShortLabel: string;
    twoMonthsAgoLabel: string;
}

export interface DetailedCostData {
    windows: CostWindows;
    twoMonthsAgo: ServiceCostTotals;
    lastMonth: ServiceCostTotals;
    thisMonth: ServiceCostTotals;
    forecastRemainingAmount: number | null;
    forecastTotal: number | null;
    serviceForecasts: Record<string, number>;
}

type CostClientConfig = Pick<DashboardConfig, 'profile' | 'region'>;

function toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function utcMonthStart(now: Date, monthOffset: number): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1));
}

function monthLabel(date: Date): string {
    return date.toLocaleString('en-US', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    });
}

function shortMonthLabel(date: Date): string {
    return date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
}

export function getCostWindows(now = new Date()): CostWindows {
    const monthStart = utcMonthStart(now, 0);
    const nextMonthStart = utcMonthStart(now, 1);
    const lastMonthStart = utcMonthStart(now, -1);
    const twoMonthsAgoStart = utcMonthStart(now, -2);

    return {
        today: toIsoDate(now),
        monthStart: toIsoDate(monthStart),
        nextMonthStart: toIsoDate(nextMonthStart),
        lastMonthStart: toIsoDate(lastMonthStart),
        twoMonthsAgoStart: toIsoDate(twoMonthsAgoStart),
        thisMonthLabel: monthLabel(monthStart),
        lastMonthLabel: monthLabel(lastMonthStart),
        lastMonthShortLabel: shortMonthLabel(lastMonthStart),
        twoMonthsAgoLabel: monthLabel(twoMonthsAgoStart),
    };
}

function todayDateStr(now = new Date()): string {
    return toIsoDate(now);
}

export function calculateForecastTotal(
    mtdAmount: number | null,
    forecastRemainingAmount: number | null,
): number | null {
    if (mtdAmount == null || forecastRemainingAmount == null) return null;
    return mtdAmount + forecastRemainingAmount;
}

export function buildRemainingForecastInput(windows: CostWindows): GetCostForecastCommandInput | null {
    if (windows.today >= windows.nextMonthStart) return null;

    return {
        TimePeriod: {
            Start: windows.today,
            End: windows.nextMonthStart,
        },
        Metric: FORECAST_COST_METRIC,
        Granularity: 'DAILY',
    };
}

function createCostClient(config: CostClientConfig): CostExplorerClient {
    return new CostExplorerClient({
        region: config.region,
        credentials: awsCredentials(config.profile),
    });
}

function amountFromString(value: string | undefined): number {
    const amount = Number.parseFloat(value ?? '0');
    return Number.isFinite(amount) ? amount : 0;
}

export function parseGroupedCosts(data: GetCostAndUsageCommandOutput | null): ServiceCostTotals {
    const services: Record<string, number> = {};
    let total = 0;

    for (const period of data?.ResultsByTime ?? []) {
        for (const group of period.Groups ?? []) {
            const name = group.Keys?.[0];
            if (!name) continue;

            const amount = amountFromString(group.Metrics?.[USAGE_COST_METRIC]?.Amount);
            if (amount <= MIN_COST_AMOUNT) continue;

            services[name] = (services[name] ?? 0) + amount;
            total += amount;
        }
    }

    return { services, total };
}

export function parseMonthlyTotals(
    data: GetCostAndUsageCommandOutput | null,
    currentMonthStart: string,
): Pick<CostData, 'lastMonth' | 'mtdAmount'> {
    let lastMonth: number | null = null;
    let mtdAmount: number | null = null;

    for (const period of data?.ResultsByTime ?? []) {
        const amount = amountFromString(period.Total?.[USAGE_COST_METRIC]?.Amount);
        const periodStart = period.TimePeriod?.Start ?? '';

        if (periodStart < currentMonthStart) {
            lastMonth = amount;
        } else {
            mtdAmount = amount;
        }
    }

    return { lastMonth, mtdAmount };
}

export function parseForecastAmount(data: GetCostForecastCommandOutput | null): number | null {
    const amount = data?.Total?.Amount;
    if (amount == null) return null;

    const parsed = Number.parseFloat(amount);
    return Number.isFinite(parsed) ? parsed : null;
}

function buildCostAndUsageInput(
    start: string,
    end: string,
    grouped: boolean,
): GetCostAndUsageCommandInput | null {
    if (start >= end) return null;

    return {
        TimePeriod: { Start: start, End: end },
        Granularity: 'MONTHLY',
        Metrics: [USAGE_COST_METRIC],
        ...(grouped ? { GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }] } : {}),
    };
}

async function getCostAndUsage(
    client: CostExplorerClient,
    input: GetCostAndUsageCommandInput | null,
): Promise<GetCostAndUsageCommandOutput | null> {
    if (!input) return null;
    return client.send(new GetCostAndUsageCommand(input));
}

async function getRemainingForecast(
    client: CostExplorerClient,
    windows: CostWindows,
): Promise<number | null> {
    const input = buildRemainingForecastInput(windows);
    if (!input) return null;

    const forecast = await client.send(new GetCostForecastCommand(input));
    return parseForecastAmount(forecast);
}

async function safeGetCostAndUsage(
    client: CostExplorerClient,
    input: GetCostAndUsageCommandInput | null,
): Promise<GetCostAndUsageCommandOutput | null> {
    try {
        return await getCostAndUsage(client, input);
    } catch {
        return null;
    }
}

async function safeGetRemainingForecast(
    client: CostExplorerClient,
    windows: CostWindows,
): Promise<number | null> {
    try {
        return await getRemainingForecast(client, windows);
    } catch {
        return null;
    }
}

export function readCostCache(now = new Date()): CostData | null {
    try {
        const raw = readFileSync(COST_CACHE_FILE, 'utf-8');
        const cache: CostCache = JSON.parse(raw);
        if (cache.version === COST_CACHE_VERSION && cache.date === todayDateStr(now)) {
            return cache.data;
        }
    } catch {
        // No cache or invalid cache. Fetch fresh data.
    }
    return null;
}

export function writeCostCache(data: CostData, now = new Date()): void {
    try {
        mkdirSync(COST_CACHE_DIR, { recursive: true });
        const cache: CostCache = {
            version: COST_CACHE_VERSION,
            date: todayDateStr(now),
            data,
        };
        writeFileSync(COST_CACHE_FILE, JSON.stringify(cache), 'utf-8');
    } catch {
        // Non-critical. The next dashboard refresh can fetch directly.
    }
}

export async function fetchDashboardCosts(
    config: CostClientConfig,
    options: { now?: Date; useCache?: boolean } = {},
): Promise<CostData> {
    const now = options.now ?? new Date();
    const cached = options.useCache === false ? null : readCostCache(now);
    if (cached) return cached;

    const windows = getCostWindows(now);
    const client = createCostClient(config);

    let lastMonth: number | null = null;
    let mtdAmount: number | null = windows.today === windows.monthStart ? 0 : null;
    let forecastRemainingAmount: number | null = null;

    try {
        const usage = await getCostAndUsage(
            client,
            buildCostAndUsageInput(windows.lastMonthStart, windows.today, false),
        );
        const totals = parseMonthlyTotals(usage, windows.monthStart);
        lastMonth = totals.lastMonth;
        mtdAmount = totals.mtdAmount ?? mtdAmount;
    } catch {
        // Cost Explorer can be unavailable or delayed. Keep nulls rather than guessing.
    }

    try {
        forecastRemainingAmount = await getRemainingForecast(client, windows);
    } catch {
        // Forecast can fail early in the month or when AWS has insufficient data.
    }

    const data: CostData = {
        lastMonth,
        lastMonthLabel: windows.lastMonthShortLabel,
        mtdAmount,
        forecastAmount: calculateForecastTotal(mtdAmount, forecastRemainingAmount),
        forecastRemainingAmount,
    };

    writeCostCache(data, now);
    return data;
}

export async function fetchDetailedCosts(
    config: CostClientConfig,
    now = new Date(),
): Promise<DetailedCostData> {
    const windows = getCostWindows(now);
    const client = createCostClient(config);
    const twoMonthsAgoInput = buildCostAndUsageInput(
        windows.twoMonthsAgoStart,
        windows.lastMonthStart,
        true,
    );
    const lastMonthInput = buildCostAndUsageInput(windows.lastMonthStart, windows.monthStart, true);
    const thisMonthInput = buildCostAndUsageInput(windows.monthStart, windows.today, true);

    const [twoMonthsAgoRaw, lastMonthRaw, thisMonthRaw, forecastRemainingAmount] = await Promise.all([
        safeGetCostAndUsage(client, twoMonthsAgoInput),
        safeGetCostAndUsage(client, lastMonthInput),
        safeGetCostAndUsage(client, thisMonthInput),
        safeGetRemainingForecast(client, windows),
    ]);

    const twoMonthsAgo = parseGroupedCosts(twoMonthsAgoRaw);
    const lastMonth = parseGroupedCosts(lastMonthRaw);
    const thisMonth = parseGroupedCosts(thisMonthRaw);
    // MTD is reliable if the month just started (total is legitimately 0) or if the
    // Cost Explorer call succeeded. If it was needed but failed, skip the forecast.
    const isMtdReliable = thisMonthInput == null || thisMonthRaw != null;
    const forecastTotal = isMtdReliable
        ? calculateForecastTotal(thisMonth.total, forecastRemainingAmount)
        : null;
    const serviceForecasts: Record<string, number> = {};

    if (forecastTotal != null && thisMonth.total > MIN_COST_AMOUNT) {
        for (const [service, amount] of Object.entries(thisMonth.services)) {
            serviceForecasts[service] = (amount / thisMonth.total) * forecastTotal;
        }
    }

    writeCostCache({
        lastMonth: lastMonth.total,
        lastMonthLabel: windows.lastMonthShortLabel,
        mtdAmount: isMtdReliable ? thisMonth.total : null,
        forecastAmount: forecastTotal,
        forecastRemainingAmount,
    }, now);

    return {
        windows,
        twoMonthsAgo,
        lastMonth,
        thisMonth,
        forecastRemainingAmount,
        forecastTotal,
        serviceForecasts,
    };
}
