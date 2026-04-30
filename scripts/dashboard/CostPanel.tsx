import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { useAwsPoll } from './useAwsPoll.js';
import type { DashboardConfig, DisplayMode } from './config.js';
import { COST_BUDGET, fetchDashboardCosts } from './costModel.js';

function gaugeColor(amount: number, budget: number): string {
    if (amount > budget) return 'red';
    if (amount > budget * 0.8) return 'yellow';
    return 'green';
}

export function CostPanel({
    config,
    mode,
}: {
    config: DashboardConfig;
    mode: DisplayMode;
}) {
    const { data, isLoading } = useAwsPoll(
        () => fetchDashboardCosts(config),
        config.intervals.costs * 1000,
        'Cost',
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
    const color = gaugeColor(fcst, COST_BUDGET);
    const overBudget = fcst > COST_BUDGET;
    const approaching = fcst > COST_BUDGET * 0.8;

    // Calm: MTD + Forecast, dim when healthy
    if (mode === 'calm' && !approaching) {
        return (
            <Box gap={1}>
                <Box width={9}><Text dimColor> Cost</Text></Box>
                <Text dimColor>${mtd.toFixed(0)} MTD · ${fcst.toFixed(0)}/${COST_BUDGET} fcst</Text>
            </Box>
        );
    }

    // Approaching or over budget, or detail mode: show full breakdown
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
                        ${fcst.toFixed(0)}/${COST_BUDGET}
                    </Text>
                    {overBudget && (
                        <Text bold color="red">
                            ⚠ +${(fcst - COST_BUDGET).toFixed(0)} over
                        </Text>
                    )}
                    {approaching && !overBudget && (
                        <Text color="yellow">
                            ({Math.round((fcst / COST_BUDGET) * 100)}%)
                        </Text>
                    )}
                </>
            ) : (
                <Text dimColor>—</Text>
            )}
        </Box>
    );
}
