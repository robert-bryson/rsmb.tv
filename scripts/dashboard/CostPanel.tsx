import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import {
    CostExplorerClient,
    GetCostAndUsageCommand,
    GetCostForecastCommand,
} from '@aws-sdk/client-cost-explorer';
import { useAwsPoll } from './useAwsPoll.js';
import type { DashboardConfig, DisplayMode } from './config.js';
import { awsCredentials } from './config.js';

const BUDGET = 50;

interface CostData {
    lastMonth: number | null;
    lastMonthLabel: string;
    mtdAmount: number | null;
    forecastAmount: number | null;
}

function gaugeColor(amount: number, budget: number): string {
    if (amount > budget) return 'red';
    if (amount > budget * 0.8) return 'yellow';
    return 'green';
}

function shortMonth(date: Date): string {
    return date.toLocaleString('en-US', { month: 'short' });
}

async function fetchCosts(config: DashboardConfig): Promise<CostData> {
    const ce = new CostExplorerClient({
        region: config.region,
        credentials: awsCredentials(config.profile),
    });

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const todayStr = today.toISOString().slice(0, 10);
    const end = endOfMonth.toISOString().slice(0, 10);
    const lastMonthLabel = shortMonth(lastMonthStart);

    let lastMonth: number | null = null;
    let mtdAmount: number | null = null;
    let forecastAmount: number | null = null;

    try {
        const usage = await ce.send(
            new GetCostAndUsageCommand({
                TimePeriod: {
                    Start: lastMonthStart.toISOString().slice(0, 10),
                    End: todayStr,
                },
                Granularity: 'MONTHLY',
                Metrics: ['UnblendedCost'],
            }),
        );
        for (const period of usage.ResultsByTime ?? []) {
            const amt = parseFloat(period.Total?.UnblendedCost?.Amount ?? '0');
            const periodStart = period.TimePeriod?.Start ?? '';
            if (periodStart < monthStart.toISOString().slice(0, 10)) {
                lastMonth = amt;
            } else {
                mtdAmount = amt;
            }
        }
    } catch {
        // Cost Explorer may not be available
    }

    try {
        if (todayStr < end) {
            const forecast = await ce.send(
                new GetCostForecastCommand({
                    TimePeriod: { Start: todayStr, End: end },
                    Metric: 'UNBLENDED_COST',
                    Granularity: 'MONTHLY',
                }),
            );
            const amount = forecast.Total?.Amount;
            if (amount) forecastAmount = parseFloat(amount);
        }
    } catch {
        // Forecast may fail early in month
    }

    return { lastMonth, lastMonthLabel, mtdAmount, forecastAmount };
}

export function CostPanel({
    config,
    mode,
}: {
    config: DashboardConfig;
    mode: DisplayMode;
}) {
    const { data, isLoading } = useAwsPoll(
        () => fetchCosts(config),
        config.intervals.costs * 1000,
    );

    if (isLoading && !data) {
        return (
            <Box gap={1}>
                <Text dimColor> Cost</Text>
                <Text color="cyan"><Spinner type="dots" /></Text>
            </Box>
        );
    }

    const last = data?.lastMonth;
    const lastLabel = data?.lastMonthLabel ?? 'Last';
    const mtd = data?.mtdAmount ?? 0;
    const forecast = data?.forecastAmount;
    const fcst = forecast ?? 0;
    const color = gaugeColor(fcst, BUDGET);
    const overBudget = fcst > BUDGET;
    const approaching = fcst > BUDGET * 0.8;

    // Calm: MTD + Forecast, dim
    if (mode === 'calm' && !approaching) {
        return (
            <Box gap={1}>
                <Text dimColor> Cost</Text>
                <Text dimColor>MTD ${mtd.toFixed(2)}</Text>
                <Text dimColor>Fcst ${fcst.toFixed(0)}</Text>
            </Box>
        );
    }

    // Approaching or over budget, or alert/detail mode: show full breakdown
    return (
        <Box gap={1}>
            <Text dimColor={!approaching} bold={approaching}> Cost</Text>
            {last != null && (
                <>
                    <Text dimColor>{lastLabel} ${last.toFixed(0)}</Text>
                    <Text dimColor>│</Text>
                </>
            )}
            <Text dimColor>MTD</Text>
            <Text color="cyan">${mtd.toFixed(2)}</Text>
            <Text dimColor>│</Text>
            <Text dimColor>Fcst</Text>
            {forecast != null ? (
                <>
                    <Text color={color} bold={overBudget}>
                        ${fcst.toFixed(0)}/${BUDGET}
                    </Text>
                    {overBudget && (
                        <Text bold color="red">
                            ⚠ +${(fcst - BUDGET).toFixed(0)} over
                        </Text>
                    )}
                    {approaching && !overBudget && (
                        <Text color="yellow">
                            ({Math.round((fcst / BUDGET) * 100)}%)
                        </Text>
                    )}
                </>
            ) : (
                <Text dimColor>—</Text>
            )}
        </Box>
    );
}
