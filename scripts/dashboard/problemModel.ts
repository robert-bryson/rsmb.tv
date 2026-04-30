export function uniqueLabels(labels: string[]): string[] {
    return [...new Set(labels)];
}

export function aggregateProblems(
    healthProblems: string[],
    alarmProblems: string[],
    buildProblems: string[],
    externalProblems: Record<string, string[]>,
): string[] {
    return uniqueLabels([
        ...healthProblems,
        ...alarmProblems,
        ...buildProblems,
        ...Object.values(externalProblems).flat(),
    ]);
}

export function getHealthProblemLabels(confirmedUnhealthy: Array<{ name: string }>): string[] {
    return uniqueLabels(confirmedUnhealthy.map((h) => `${h.name} down`));
}

export function getExternalProblemLabels(
    confirmedUnhealthy: Array<{ name: string }>,
    alerts: Array<{ kind: 'incident' | 'maintenance'; name: string }>,
): string[] {
    return uniqueLabels([
        ...confirmedUnhealthy.map((h) => `${h.name} down`),
        ...alerts.filter((a) => a.kind === 'incident').map((a) => `${a.name} incident`),
    ]);
}