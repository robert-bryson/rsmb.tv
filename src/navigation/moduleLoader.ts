const failedStyles = new Set<string>();
export const MAPLIBRE_STYLESHEET = /\/maplibre-gl-[^/]+\.css$/;

/** Share preparation with navigation, without retaining a rejected application promise. */
export function moduleLoader<T>(load: () => Promise<T>, sharedStyles?: RegExp): () => Promise<T> {
    let pending: Promise<T> | undefined;
    let failedStylesheet: string | undefined;
    return () => {
        if (!pending) {
            pending = Promise.resolve().then(async () => {
                const styles = [...failedStyles].filter(href => href === failedStylesheet || sharedStyles?.test(href));
                if (styles.length) {
                    const { retryStylesheet } = await import('./retryStylesheet');
                    await settlePreparation(styles.map(async href => { await retryStylesheet(href); failedStyles.delete(href); }));
                    failedStylesheet = undefined;
                }
                return load();
            });
            const current = pending;
            void current.catch(error => {
                // Vite retains failed CSS preload entries. Restore the stylesheet before retrying
                // the module, otherwise a later import can succeed with its styles missing.
                if (error instanceof Error) {
                    failedStylesheet = /^Unable to preload CSS for (.+)$/.exec(error.message)?.[1] ?? failedStylesheet;
                    if (failedStylesheet) failedStyles.add(failedStylesheet);
                }
                if (pending === current) pending = undefined;
            });
        }
        return pending;
    };
}

/** Await every started branch, including when a sibling fails early. */
export async function settlePreparation(tasks: Promise<unknown>[]) {
    const results = await Promise.allSettled(tasks);
    const failed = results.find(result => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
}
