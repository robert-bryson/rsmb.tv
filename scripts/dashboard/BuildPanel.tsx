import React, { useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { useAwsPoll } from './useAwsPoll.js';
import type { DashboardConfig, DisplayMode } from './config.js';
import { link } from './config.js';
import {
    buildDisplayLabel,
    buildKey,
    getBuildDisplaySections,
    getBuildProblemLabels,
    isFailure,
    isRunning,
    isStaleWorkflow,
    type BuildInfo,
} from './buildModel.js';
import { fetchAllBuilds } from './buildFetchers.js';

function statusColor(status: string): string {
    const s = status.toUpperCase();
    if (['SUCCEED', 'SUCCESS', 'COMPLETED'].includes(s)) return 'green';
    if (['FAILED', 'FAILURE', 'CANCELLED'].includes(s)) return 'red';
    if (['PENDING', 'RUNNING', 'IN_PROGRESS', 'QUEUED'].includes(s))
        return 'yellow';
    return 'gray';
}

function statusLabel(status: string): string {
    const s = status.toUpperCase();
    if (['SUCCEED', 'SUCCESS', 'COMPLETED'].includes(s)) return '✓';
    if (['FAILED', 'FAILURE', 'CANCELLED'].includes(s)) return '✗';
    if (['PENDING', 'RUNNING', 'IN_PROGRESS', 'QUEUED'].includes(s)) return '…';
    return '?';
}

function BuildRow({ build, indent = 4 }: { build: BuildInfo; indent?: number }) {
    return (
        <Box gap={1}>
            <Text>{' '.repeat(indent)}</Text>
            <Text color={statusColor(build.status)}>●</Text>
            <Text> </Text>
            <Box width={24}>
                <Text>{buildDisplayLabel(build)}</Text>
            </Box>
            <Box width={4}>
                <Text color={statusColor(build.status)}>{statusLabel(build.status)}</Text>
            </Box>
            <Box width={8}>
                <Text>{link(build.url, build.id)}</Text>
            </Box>
            <Box width={6}>
                <Text dimColor>{build.branch}</Text>
            </Box>
            <Text dimColor>{build.time}</Text>
        </Box>
    );
}

function WorkflowRow({ build }: { build: BuildInfo }) {
    return (
        <Box gap={1}>
            <Text>      </Text>
            <Text color={statusColor(build.status)}>●</Text>
            <Text> </Text>
            <Box width={22}>
                <Text dimColor>{build.label}</Text>
            </Box>
            <Box width={4}>
                <Text color={statusColor(build.status)}>{statusLabel(build.status)}</Text>
            </Box>
            <Box width={8}>
                <Text>{link(build.url, build.id)}</Text>
            </Box>
            <Box width={6}>
                <Text dimColor>{build.branch}</Text>
            </Box>
            <Text dimColor>{build.time}</Text>
        </Box>
    );
}

export function BuildPanel({
    config,
    mode,
    onProblems,
}: {
    config: DashboardConfig;
    mode: DisplayMode;
    onProblems: (labels: string[]) => void;
}) {
    const { data, isLoading, isStale, error } = useAwsPoll(
        () => fetchAllBuilds(config),
        config.intervals.builds * 1000,
        'Builds',
    );

    const items = data ?? [];
    const failures = items.filter((b) => isFailure(b.status));
    const running = items.filter((b) => isRunning(b.status));
    const staleWorkflows = items.filter((b) => isStaleWorkflow(b));
    const hasProblems = failures.length > 0;

    const problemLabels = useMemo(
        () => getBuildProblemLabels(data ?? []),
        [data],
    );

    useEffect(() => {
        onProblems(problemLabels);
    }, [problemLabels, onProblems]);

    // Calm mode: summary dots + running builds on second line
    if (mode === 'calm') {
        return (
            <Box flexDirection="column">
                <Box gap={1}>
                    <Box width={9}><Text dimColor> Builds</Text></Box>
                    {isLoading && !data ? (
                        <Text color="cyan"><Spinner type="dots" /></Text>
                    ) : error && !data ? (
                        <Text color="red">⚠ connection error</Text>
                    ) : (
                        <>
                            <Box width={25} gap={1}>
                                {items.map((b) => (
                                    <Text key={buildKey(b)} color={isStaleWorkflow(b) ? 'yellow' : statusColor(b.status)}>
                                        {isStaleWorkflow(b) ? '⚠' : statusLabel(b.status)}
                                    </Text>
                                ))}
                            </Box>
                            {hasProblems && <Text color="red">{failures.length} failed</Text>}
                            {!hasProblems && running.length === 0 && staleWorkflows.length === 0 && <Text dimColor>OK</Text>}
                            {staleWorkflows.length > 0 && !hasProblems && (
                                <Text color="yellow">{staleWorkflows.map((b) => b.label).join(', ')} stale</Text>
                            )}
                        </>
                    )}
                    {isStale && <Text color="yellow">⚠ stale</Text>}
                </Box>
                {running.map((b) => (
                    <Box key={buildKey(b)} gap={1}>
                        <Text>  </Text>
                        <Text color="yellow"><Spinner type="dots" /></Text>
                        <Text color="yellow"> {buildDisplayLabel(b)}</Text>
                        <Text>{link(b.url, b.id)}</Text>
                        <Text dimColor>{b.time}</Text>
                    </Box>
                ))}
                {failures.map((b) => (
                    <BuildRow key={buildKey(b)} build={b} />
                ))}
            </Box>
        );
    }

    // Detail mode
    const sections = getBuildDisplaySections(items);

    return (
        <Box flexDirection="column">
            <Box gap={1}>
                <Text bold> BUILDS</Text>
                {isLoading && !data ? (
                    <Text color="cyan"><Spinner type="dots" /></Text>
                ) : !hasProblems ? (
                    <>
                        {items.map((b) => (
                            <Text key={buildKey(b)} color={statusColor(b.status)}>
                                {statusLabel(b.status)}
                            </Text>
                        ))}
                        <Text dimColor>All passing</Text>
                    </>
                ) : (
                    <Text color="red">
                        {failures.length} failed
                    </Text>
                )}
                {isStale && <Text color="yellow">(stale)</Text>}
            </Box>

            {error && !data && (
                <Text color="red">  Error: {error}</Text>
            )}

            {sections.map((section) => (
                <Box key={section.label} flexDirection="column">
                    <Text dimColor>  {section.label}</Text>
                    {section.mainBuilds.map((b) => (
                        <React.Fragment key={buildKey(b)}>
                            <BuildRow build={b} />
                            {(section.workflowsByProject.get(b.project) ?? []).map((wf) => (
                                <WorkflowRow key={buildKey(wf)} build={wf} />
                            ))}
                        </React.Fragment>
                    ))}
                    {section.orphanedWorkflowGroups.map((group) => (
                        <React.Fragment key={`${section.label}:${group.project}:workflows`}>
                            <Text dimColor>    {group.project}</Text>
                            {group.workflows.map((wf) => (
                                <WorkflowRow key={buildKey(wf)} build={wf} />
                            ))}
                        </React.Fragment>
                    ))}
                </Box>
            ))}

            {!config.githubToken && mode === 'detail' && (
                <Text dimColor>  ⚠ Set GITHUB_TOKEN for GitHub Actions builds</Text>
            )}
        </Box>
    );
}
