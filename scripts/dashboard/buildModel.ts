import type { ProjectConfig } from './config.js';
import { uniqueLabels } from './problemModel.js';

export interface BuildInfo {
    project: string;
    label: string;
    source: 'amplify' | 'github';
    status: string;
    id: string;
    branch: string;
    time: string;
    url: string;
    createdAt: Date | null;
    staleThresholdHours: number | undefined;
}

export interface BuildProjectSelection {
    amplifyProjects: ProjectConfig[];
    githubProjects: ProjectConfig[];
    workflowProjects: ProjectConfig[];
}

export interface BuildWorkflowGroup {
    project: string;
    workflows: BuildInfo[];
}

export interface BuildDisplaySection {
    label: string;
    mainBuilds: BuildInfo[];
    workflowsByProject: Map<string, BuildInfo[]>;
    orphanedWorkflowGroups: BuildWorkflowGroup[];
}

export function selectBuildProjects(projects: ProjectConfig[]): BuildProjectSelection {
    return {
        amplifyProjects: projects.filter((p) => p.kind === 'amplify' && p.amplifyAppId),
        githubProjects: projects.filter((p) => p.githubRepo && !p.workflows?.length),
        workflowProjects: projects.filter((p) => p.githubRepo && p.workflows?.length),
    };
}

export function buildKey(build: BuildInfo): string {
    return `${build.source}:${build.project}:${build.label}`;
}

export function uniqueBuilds(builds: BuildInfo[]): BuildInfo[] {
    const seen = new Set<string>();
    return builds.filter((build) => {
        const key = buildKey(build);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function buildDisplayLabel(build: BuildInfo): string {
    return build.label === build.project ? build.label : `${build.project} ${build.label}`;
}

export function isSuccess(status: string): boolean {
    const s = status.toUpperCase();
    return ['SUCCEED', 'SUCCESS', 'COMPLETED'].includes(s);
}

export function isFailure(status: string): boolean {
    const s = status.toUpperCase();
    return ['FAILED', 'FAILURE', 'CANCELLED', 'ERROR', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE'].includes(s);
}

export function isRunning(status: string): boolean {
    const s = status.toUpperCase();
    return ['PENDING', 'RUNNING', 'IN_PROGRESS', 'QUEUED', 'REQUESTED', 'WAITING'].includes(s);
}

export function isUnknownStatus(status: string): boolean {
    return status.toUpperCase() === 'UNKNOWN';
}

export function isWarningStatus(status: string): boolean {
    return !isSuccess(status) && !isFailure(status) && !isRunning(status);
}

export function isStaleWorkflow(build: BuildInfo): boolean {
    if (!build.staleThresholdHours || !build.createdAt) return false;
    const ageHours = (Date.now() - build.createdAt.getTime()) / (1000 * 60 * 60);
    return ageHours > build.staleThresholdHours;
}

export function getBuildProblemLabels(builds: BuildInfo[]): string[] {
    return uniqueLabels(
        builds.flatMap((build) => {
            const label = buildDisplayLabel(build);

            if (isFailure(build.status)) return [`${label} build failed`];
            if (isStaleWorkflow(build)) return [`${label} build stale`];
            if (isWarningStatus(build.status)) return [`${label} build status ${build.status.toLowerCase()}`];

            return [];
        }),
    );
}

export function getBuildDisplaySections(items: BuildInfo[]): BuildDisplaySection[] {
    const sourceSections: Array<{ label: string; source: BuildInfo['source'] }> = [
        { label: 'AWS Amplify', source: 'amplify' },
        { label: 'GitHub Actions', source: 'github' },
    ];

    return sourceSections.flatMap((sourceSection) => {
        const builds = items.filter((b) => b.source === sourceSection.source);
        if (builds.length === 0) return [];

        const mainBuilds = builds.filter((b) => b.label === b.project);
        const workflowsByProject = new Map<string, BuildInfo[]>();

        for (const build of builds) {
            if (build.label === build.project) continue;
            const workflows = workflowsByProject.get(build.project) ?? [];
            workflows.push(build);
            workflowsByProject.set(build.project, workflows);
        }

        const renderedProjects = new Set(mainBuilds.map((b) => b.project));
        const orphanedWorkflowGroups = [...workflowsByProject]
            .filter(([project]) => !renderedProjects.has(project))
            .map(([project, workflows]) => ({ project, workflows }));

        return [{
            label: sourceSection.label,
            mainBuilds,
            workflowsByProject,
            orphanedWorkflowGroups,
        }];
    });
}