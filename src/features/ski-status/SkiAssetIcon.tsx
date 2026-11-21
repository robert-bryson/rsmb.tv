import { useState, type ReactNode } from 'react';

interface Props {
    urls: readonly (string | undefined)[];
    size: number;
    className?: string;
    fallback?: ReactNode;
}

export function SkiAssetIcon({ urls, size, className, fallback }: Props) {
    const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
    const src = urls.find(url => url && !failed.has(url));
    if (!src) return fallback ?? null;
    return <img src={src} width={size} height={size} className={className} alt=""
        onError={() => setFailed(previous => new Set(previous).add(src))} />;
}
