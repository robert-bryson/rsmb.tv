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
    isSuccess,
    isStaleWorkflow,
    isUnknownStatus,
    isWarningStatus,
    type BuildInfo,
} from './buildModel.js';
import { fetchAllBuilds } from './buildFetchers.js';

const MAIN_LABEL_WIDTH = 24;
const WORKFLOW_LABEL_WIDTH = 22;
const STATUS_WIDTH = 4;
const ID_WIDTH = 8;
const BRANCH_WIDTH = 6;

function statusColor(status: string): string {
    const s = status.toUpperCase();
    if (isSuccess(s)) return 'green';
    if (isFailure(s)) return 'red';
    if (isRunning(s) || isWarningStatus(s)) return 'yellow';
    return 'gray';
}

function statusLabel(status: string): string {
    const s = status.toUpperCase();
    if (isSuccess(s)) return '✓';
    if (isFailure(s)) return '✗';
    if (isRunning(s)) return '…';
    return '?';
}

function buildIssueSummary(
    failures: BuildInfo[],
    staleWorkflows: BuildInfo[],
    unknownBuilds: BuildInfo[],
    warningBuilds: BuildInfo[],
): string {
    return [
        failures.length > 0 ? `${failures.length} failed` : undefined,
        staleWorkflows.length > 0 ? `${staleWorkflows.length} stale` : undefined,
        unknownBuilds.length > 0 ? `${unknownBuilds.length} unknown` : undefined,
        warningBuilds.length > 0 ? `${warningBuilds.length} status warning${warningBuilds.length === 1 ? '' : 's'}` : undefined,
    ].filter((part): part is string => part !== undefined).join(', ');
}

function BuildRow({ build, indent = 4 }: { build: BuildInfo; indent?: number }) {
    return (
        <Box gap={1}>
            <Text>{' '.repeat(indent)}</Text>
            <Text color={statusColor(build.status)}>●</Text>
            <Text> </Text>
            <Box width={MAIN_LABEL_WIDTH}>
                <Text>{buildDisplayLabel(build)}</Text>
            </Box>
            <Box width={STATUS_WIDTH}>
                <Text color={statusColor(build.status)}>{statusLabel(build.status)}</Text>
            </Box>
            <Box width={ID_WIDTH}>
                <Text>{link(build.url, build.id)}</Text>
            </Box>
            <Box width={BRANCH_WIDTH}>
                <Text dimColor>{build.branch}</Text>
            </Box>
            <Text dimColor>{build.time}</Text>
        </Box>
    );
}

export function RunningBuildRow({ build }: { build: BuildInfo }) {
    return (
        <Box gap={1}>
            <Text>    </Text>
            <Text color="yellow"><Spinner type="dots" /></Text>
            <Text> </Text>
            <Box width={MAIN_LABEL_WIDTH}><Text color="yellow">{buildDisplayLabel(build)}</Text></Box>
            <Box width={ID_WIDTH}><Text>{link(build.url, build.id)}</Text></Box>
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
            <Box width={WORKFLOW_LABEL_WIDTH}>
                <Text dimColor>{build.label}</Text>
            </Box>
            <Box width={STATUS_WIDTH}>
                <Text color={statusColor(build.status)}>{statusLabel(build.status)}</Text>
            </Box>
            <Box width={ID_WIDTH}>
                <Text>{link(build.url, build.id)}</Text>
            </Box>
            <Box width={BRANCH_WIDTH}>
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
    const unknownBuilds = items.filter((b) => isUnknownStatus(b.status));
    const warningBuilds = items.filter((b) => isWarningStatus(b.status) && !isUnknownStatus(b.status));

    const problemLabels = useMemo(
        () => getBuildProblemLabels(data ?? []),
        [data],
    );
    const hasProblems = problemLabels.length > 0;
    const issueSummary = buildIssueSummary(failures, staleWorkflows, unknownBuilds, warningBuilds);

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
                            {hasProblems && <Text color={failures.length > 0 ? 'red' : 'yellow'}>{issueSummary}</Text>}
                            {!hasProblems && running.length === 0 && staleWorkflows.length === 0 && <Text dimColor>OK</Text>}
                        </>
                    )}
                    {isStale && <Text color="yellow">⚠ stale</Text>}
                </Box>
                {running.map((b) => (
                    <RunningBuildRow key={buildKey(b)} build={b} />
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
                ) : !hasProblems && running.length === 0 ? (
                    <>
                        {items.map((b) => (
                            <Text key={buildKey(b)} color={isStaleWorkflow(b) ? 'yellow' : statusColor(b.status)}>
                                {statusLabel(b.status)}
                            </Text>
                        ))}
                        <Text dimColor>All passing</Text>
                    </>
                ) : running.length > 0 && !hasProblems ? (
                    <Text color="yellow">
                        {running.length} running
                    </Text>
                ) : (
                    <Text color={failures.length > 0 ? 'red' : 'yellow'}>
                        {issueSummary}
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
