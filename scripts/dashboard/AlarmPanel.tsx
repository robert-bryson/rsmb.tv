import React, { useRef, useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import {
    CloudWatchClient,
    DescribeAlarmsCommand,
    type MetricAlarm,
} from '@aws-sdk/client-cloudwatch';
import { useAwsPoll } from './useAwsPoll.js';
import type { DashboardConfig, DisplayMode } from './config.js';
import { awsCredentials, link } from './config.js';
import { useIncidentDetection } from './useIncidentLog.js';

interface AlarmInfo {
    name: string;
    state: string;
    reason: string;
}

interface AlarmData {
    alarms: AlarmInfo[];
    allClear: boolean;
}

const ALARM_PREFIXES = ['rsmbtv-', 'bookend-', 'through-routes-'];

function alarmConsoleUrl(name: string, region: string): string {
    return `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#alarmsV2:alarm/${encodeURIComponent(name)}`;
}

function stateColor(state: string): string {
    if (state === 'OK') return 'green';
    if (state === 'ALARM') return 'red';
    return 'yellow';
}

async function fetchAlarms(config: DashboardConfig): Promise<AlarmData> {
    const cw = new CloudWatchClient({
        region: config.region,
        credentials: awsCredentials(config.profile),
    });

    const alarmResults: MetricAlarm[] = [];
    for (const prefix of ALARM_PREFIXES) {
        const res = await cw.send(
            new DescribeAlarmsCommand({ AlarmNamePrefix: prefix }),
        );
        alarmResults.push(...(res.MetricAlarms ?? []));
    }

    const alarms: AlarmInfo[] = alarmResults.map((a) => ({
        name: a.AlarmName ?? 'Unknown',
        state: a.StateValue ?? 'UNKNOWN',
        reason: a.StateReason ?? '',
    }));

    const allClear = alarms.every((a) => a.state === 'OK');

    return { alarms, allClear };
}

export function AlarmPanel({
    config,
    mode,
    onProblems,
}: {
    config: DashboardConfig;
    mode: DisplayMode;
    onProblems: (v: boolean) => void;
}) {
    const { data, isLoading, isStale, error } = useAwsPoll(
        () => fetchAlarms(config),
        config.intervals.alarms * 1000,
        'Alarms',
    );

    const firingAlarms = (data?.alarms ?? []).filter((a) => a.state !== 'OK');
    const hasProblems = firingAlarms.length > 0;

    useEffect(() => {
        onProblems(hasProblems);
    }, [hasProblems, onProblems]);

    // Record incidents when alarms start/stop firing
    const incidentDown = useMemo(
        () => data ? new Map(firingAlarms.map((a) => [a.name, a.state])) : null,
        // eslint-disable-next-line react-hooks/exhaustive-deps -- firingAlarms is derived from data
        [data],
    );
    useIncidentDetection('Alarms', incidentDown);

    // Ring terminal bell when new alarms start firing
    const prevFiringCount = useRef(0);
    useEffect(() => {
        if (firingAlarms.length > 0 && firingAlarms.length > prevFiringCount.current) {
            process.stdout.write('\x07');
        }
        prevFiringCount.current = firingAlarms.length;
    }, [firingAlarms.length]);

    // Calm mode: terse inline
    if (mode === 'calm') {
        return (
            <Box gap={1}>
                <Box width={9}><Text dimColor> Alarms</Text></Box>
                {isLoading && !data ? (
                    <Text color="cyan"><Spinner type="dots" /></Text>
                ) : error && !data ? (
                    <Text color="red">⚠ error</Text>
                ) : (
                    <>
                        <Box width={25} gap={1}>
                            <Text>
                                {(data?.alarms ?? []).map((a, i) => (
                                    <Text key={i} color={stateColor(a.state)}>
                                        {a.state === 'OK' ? '✓' : '✗'}
                                        {i < (data?.alarms.length ?? 0) - 1 ? ' ' : ''}
                                    </Text>
                                ))}
                            </Text>
                        </Box>
                        {data?.allClear && <Text dimColor>OK</Text>}
                        {!data?.allClear && <Text color="red">{firingAlarms.length} firing</Text>}
                        {isStale && <Text color="yellow">(stale)</Text>}
                    </>
                )}
            </Box>
        );
    }

    // Alert/Detail: show banner for firing alarms, expand details
    const showAllAlarms = mode === 'detail';

    return (
        <Box flexDirection="column">
            {/* Big red banner when alarms fire — always visible in alert/detail */}
            {firingAlarms.length > 0 && (
                <Box>
                    <Text bold backgroundColor="red" color="white">
                        {' 🚨 ALARM: ' + firingAlarms.map((a) => a.name).join(', ') + ' '}
                    </Text>
                </Box>
            )}

            <Box gap={1}>
                <Text bold> ALARMS</Text>
                {isLoading && !data ? (
                    <Text color="cyan"><Spinner type="dots" /></Text>
                ) : data?.allClear ? (
                    <Text color="green">all clear ✓</Text>
                ) : (
                    <Text color="red">
                        {firingAlarms.length} alarm{firingAlarms.length !== 1 ? 's' : ''} firing ✗
                    </Text>
                )}
                {isStale && <Text color="yellow">(stale)</Text>}
            </Box>

            {error && !data && (
                <Text color="red">  Error: {error}</Text>
            )}

            {/* Alert mode: only firing alarms. Detail mode: all alarms */}
            {data &&
                (showAllAlarms ? data.alarms : firingAlarms).map((a) => (
                    <Box key={a.name} gap={1}>
                        <Text>  </Text>
                        <Text color={stateColor(a.state)}>●</Text>
                        <Text> </Text>
                        <Box width={35}>
                            <Text>{link(alarmConsoleUrl(a.name, config.region), a.name)}</Text>
                        </Box>
                        <Text color={stateColor(a.state)}>{a.state}</Text>
                    </Box>
                ))}
        </Box>
    );
}
