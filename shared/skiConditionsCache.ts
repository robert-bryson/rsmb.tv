export const skiConditionsRefreshWaitMs = 35_000;

export function skiConditionsDirectory(rockies: boolean) {
    return rockies ? '.cache/ski-status-rockies' : '.cache/ski-status';
}
