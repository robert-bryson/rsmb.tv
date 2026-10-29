import type { LaunchOptions } from '@playwright/test';

/** Keep configured browser options while enabling Chromium's native scrollbars. */
export function withVisibleScrollbars(browserName: string, options: LaunchOptions): LaunchOptions {
    if (browserName !== 'chromium' || options.ignoreDefaultArgs === true) return options;
    const ignoredArguments = Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : [];
    return {
        ...options,
        ignoreDefaultArgs: [...new Set([...ignoredArguments, '--hide-scrollbars'])],
    };
}
