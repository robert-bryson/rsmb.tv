import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import { HealthPanel } from './HealthPanel.js';
import { AlarmPanel } from './AlarmPanel.js';
import { BuildPanel } from './BuildPanel.js';
import { CostPanel } from './CostPanel.js';
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
    const [termHeight, setTermHeight] = useState(stdout.rows ?? 24);

    const hasProblems = healthProblems || alarmProblems || buildProblems;
    const mode: DisplayMode = forceDetail ? 'detail' : hasProblems ? 'alert' : 'calm';

    useEffect(() => {
        const onResize = () => setTermHeight(stdout.rows ?? 24);
        stdout.on('resize', onResize);
        return () => { stdout.off('resize', onResize); };
    }, [stdout]);

    const handleInput = useCallback(
        (input: string) => {
            if (input === 'q') exit();
            if (input === 'h') setForceDetail((v) => !v);
        },
        [exit],
    );

    useInput(handleInput);

    const modeLabel = forceDetail ? 'detail' : 'auto';

    return (
        <Box flexDirection="column" paddingX={1} height={termHeight}>
            {/* Header */}
            <Box justifyContent="space-between">
                <Text bold color="cyan">
                    rsmb.tv Dashboard
                </Text>
                <Clock />
            </Box>

            <Text dimColor>{'─'.repeat(60)}</Text>

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

            {/* Spacer to push footer to bottom */}
            <Box flexGrow={1} />

            {/* Footer */}
            <Text dimColor>{'─'.repeat(60)}</Text>
            <Text dimColor>
                {' '}
                [q] quit  [h] {forceDetail ? 'compact' : 'details'}  ({modeLabel})
            </Text>
        </Box>
    );
}
