import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import { HealthPanel } from './HealthPanel.js';
import { AlarmPanel } from './AlarmPanel.js';
import { BuildPanel } from './BuildPanel.js';
import { CostPanel } from './CostPanel.js';
import { ExternalHealthPanel } from './ExternalHealthPanel.js';
import type { DashboardConfig } from './config.js';
import type { DisplayMode } from './config.js';

function Clock() {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    return (
        <Text dimColor>
            {now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
            })}
        </Text>
    );
}

export function App({ config }: { config: DashboardConfig }) {
    const { exit } = useApp();
    const { stdout } = useStdout();
    const [forceDetail, setForceDetail] = useState(false);
    const [healthProblems, setHealthProblems] = useState(false);
    const [alarmProblems, setAlarmProblems] = useState(false);
    const [buildProblems, setBuildProblems] = useState(false);
    const [externalProblems, setExternalProblems] = useState<Record<string, boolean>>({});
    const [termHeight, setTermHeight] = useState(stdout.rows ?? 24);
    const [scrollOffset, setScrollOffset] = useState(0);

    const hasExternalProblems = Object.values(externalProblems).some(Boolean);
    const hasProblems = healthProblems || alarmProblems || buildProblems || hasExternalProblems;
    const mode: DisplayMode = forceDetail ? 'detail' : hasProblems ? 'alert' : 'calm';

    // Stable per-group callbacks — one per group id, never re-created
    const externalGroupCallbacks = useMemo(() => {
        const map: Record<string, (v: boolean) => void> = {};
        for (const group of config.externalGroups) {
            map[group.id] = (v: boolean) =>
                setExternalProblems((prev) => prev[group.id] === v ? prev : { ...prev, [group.id]: v });
        }
        return map;
    }, [config.externalGroups]);

    useEffect(() => {
        const onResize = () => setTermHeight(stdout.rows ?? 24);
        stdout.on('resize', onResize);
        return () => { stdout.off('resize', onResize); };
    }, [stdout]);

    const handleInput = useCallback(
        (input: string, key: { upArrow: boolean; downArrow: boolean }) => {
            if (input === 'q') exit();
            if (input === 'h') { setForceDetail((v) => !v); setScrollOffset(0); }
            if (input === 'j' || key.downArrow) setScrollOffset((v) => v + 1);
            if (input === 'k' || key.upArrow) setScrollOffset((v) => Math.max(0, v - 1));
        },
        [exit],
    );

    useInput(handleInput);

    const modeLabel = forceDetail ? 'detail' : 'auto';

    const scrollHint = scrollOffset > 0 ? ' ↑' : '';

    return (
        <Box flexDirection="column" paddingX={1} height={termHeight}>
            {/* Header */}
            <Box justifyContent="space-between">
                <Text bold color="cyan">
                    Watch Dashboard
                </Text>
                <Clock />
            </Box>

            <Text dimColor>{'─'.repeat(60)}</Text>

            {/* Scrollable content area */}
            <Box flexDirection="column" flexGrow={1} overflow="hidden">
                <Box flexDirection="column" flexShrink={0} marginTop={-scrollOffset}>

                    {/* ── rsmb.tv ────────────────────────────────────── */}
                    <Text bold color="cyan"> rsmb.tv</Text>

                    {/* Health */}
                    <HealthPanel config={config} mode={mode} onProblems={setHealthProblems} />

                    {mode !== 'calm' && <Text> </Text>}

                    {/* Alarms */}
                    <AlarmPanel config={config} mode={mode} onProblems={setAlarmProblems} />

                    {mode !== 'calm' && <Text> </Text>}

                    {/* Builds */}
                    <BuildPanel config={config} mode={mode} onProblems={setBuildProblems} />

                    {mode !== 'calm' && <Text> </Text>}

                    {/* Cost */}
                    <CostPanel config={config} mode={mode} />

                    {/* ── External groups ─────────────────────────────── */}
                    {config.externalGroups.map((group) => (
                        <Box key={group.id} flexDirection="column">
                            <Text> </Text>
                            <Text dimColor>{'─'.repeat(60)}</Text>
                            <Text bold color="cyan"> {group.label}</Text>
                            <ExternalHealthPanel
                                group={group}
                                intervalMs={config.intervals.external * 1000}
                                mode={mode}
                                onProblems={externalGroupCallbacks[group.id]}
                            />
                        </Box>
                    ))}

                </Box>
            </Box>

            {/* Footer */}
            <Text dimColor>{'─'.repeat(60)}</Text>
            <Text dimColor>
                {' '}
                [q] quit  [h] {forceDetail ? 'compact' : 'details'}  [↑↓] scroll  ({modeLabel}){scrollHint}
            </Text>
        </Box>
    );
}
