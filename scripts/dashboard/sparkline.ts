const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

export function sparkline(values: number[], width = 20): string {
    const data = values.slice(-width);
    if (data.length === 0) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    return data
        .map((v) => BLOCKS[Math.min(7, Math.floor(((v - min) / range) * 7))])
        .join('');
}
