type ShareResult = 'shared' | 'cancelled' | 'copied' | 'manual';

export async function shareLink(title: string, url: string): Promise<ShareResult> {
    if (navigator.share) {
        try {
            await navigator.share({ title, url });
            return 'shared';
        } catch (error) {
            if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return 'cancelled';
        }
    }
    if (!navigator.clipboard?.writeText) return 'manual';
    try {
        await navigator.clipboard.writeText(url);
        return 'copied';
    } catch {
        return 'manual';
    }
}
