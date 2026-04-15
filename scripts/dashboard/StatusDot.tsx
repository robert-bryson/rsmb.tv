import React from 'react';
import { Text } from 'ink';

export function StatusDot({ healthy, stale, warning }: { healthy: boolean | null; stale: boolean; warning?: boolean }) {
    if (stale) return <Text color="yellow">●</Text>;
    if (warning) return <Text color="yellow">⚠</Text>;
    if (healthy === null) return <Text color="gray">●</Text>;
    return healthy ? <Text color="green">●</Text> : <Text color="red">●</Text>;
}
