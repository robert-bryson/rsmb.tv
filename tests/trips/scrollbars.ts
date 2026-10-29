import { test } from '@playwright/test';
import { withVisibleScrollbars } from '../../scripts/trip-browser-options';

export const scrollbarTest = test.extend({
    launchOptions: async ({ browserName, launchOptions }, runWithOptions) => {
        await runWithOptions(withVisibleScrollbars(browserName, launchOptions));
    },
});
