import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.skip(process.env.PAGE_RECOVERY !== '1', 'Uses the production bundle and a local tracker substitute.');

type AnalyticsPayload = { name: string; url: string; data: Record<string, string> };

async function productionOrigin(page: Page, baseURL: string) {
    await page.route('https://www.rsmb.tv/**', async route => {
        const requested = new URL(route.request().url());
        const response = await route.fetch({ url: `${baseURL}${requested.pathname}${requested.search}` });
        await route.fulfill({ response });
    });
}

const tracker = `
    window.__analyticsEvents = [];
    window.__analyticsDocument = crypto.randomUUID();
    const hook = window[document.currentScript.dataset.beforeSend];
    window.umami = {
        track(callback) {
            const payload = callback({ url: location.href, referrer: document.referrer, title: document.title });
            const clean = hook('event', payload);
            if (clean) window.__analyticsEvents.push(clean);
            return Promise.resolve();
        },
        captureException() {},
    };
`;

async function events(page: Page): Promise<AnalyticsPayload[]> {
    return page.evaluate(() => (window as Window & { __analyticsEvents?: AnalyticsPayload[] }).__analyticsEvents ?? []);
}

test('project events keep SPA navigation and exclude private URL state', async ({ page, baseURL }) => {
    await productionOrigin(page, baseURL!);
    await page.route('https://cloud.umami.is/script.js', route => route.fulfill({ contentType: 'application/javascript', body: tracker }));
    await page.goto('https://www.rsmb.tv/projects?token=private#private');
    await expect(page.locator('#umami-analytics')).toHaveAttribute('data-tag', 'rsmb-tv');
    await page.waitForFunction(() => Boolean((window as Window & { __analyticsDocument?: string }).__analyticsDocument));
    const documentId = await page.evaluate(() => (window as Window & { __analyticsDocument?: string }).__analyticsDocument);
    await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Flights', exact: true }) }).click();
    await expect(page).toHaveURL('https://www.rsmb.tv/projects/flights');
    await expect.poll(() => events(page)).toContainEqual(expect.objectContaining({
        url: '/projects', referrer: '', tag: 'rsmb-tv',
        name: 'project-link-click', data: { project: 'flights', destination: 'details', placement: 'projects' },
    }));
    expect(await page.evaluate(() => (window as Window & { __analyticsDocument?: string }).__analyticsDocument)).toBe(documentId);
    expect(JSON.stringify(await events(page))).not.toContain('private');
});

test('blocked analytics leaves navigation usable', async ({ page, baseURL }) => {
    await productionOrigin(page, baseURL!);
    await page.route('https://cloud.umami.is/script.js', route => route.abort('blockedbyclient'));
    await page.goto('https://www.rsmb.tv/projects');
    await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Flights', exact: true }) }).click();
    await expect(page).toHaveURL('https://www.rsmb.tv/projects/flights');
    await expect(page.getByRole('heading', { name: 'Flights', exact: true })).toBeVisible();
});

test('privacy preferences prevent the tracker request on production', async ({ page, baseURL }) => {
    await productionOrigin(page, baseURL!);
    let requests = 0;
    await page.route('https://cloud.umami.is/script.js', route => { requests++; return route.abort(); });
    await page.addInitScript(() => Object.defineProperty(navigator, 'globalPrivacyControl', { value: true }));
    await page.goto('https://www.rsmb.tv/projects');
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
    await expect(page.locator('#umami-analytics')).toHaveCount(0);
    expect(requests).toBe(0);
});

test('the hosted tracker sends sanitized pageviews, events, and errors', async ({ page, baseURL }) => {
    test.skip(!process.env.UMAMI_TRACKER_FIXTURE, 'Set UMAMI_TRACKER_FIXTURE to a reviewed Umami Cloud script.');
    const source = await readFile(process.env.UMAMI_TRACKER_FIXTURE!, 'utf8');
    const requests: Array<{ type: string; payload: Record<string, unknown> }> = [];
    await productionOrigin(page, baseURL!);
    await page.route('https://cloud.umami.is/script.js', route => route.fulfill({ contentType: 'application/javascript', body: source }));
    await page.route('https://gateway.umami.is/api/send', async route => {
        const request = route.request();
        if (request.method() === 'POST') requests.push(request.postDataJSON());
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}', headers: {
            'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS',
        } });
    });
    await page.goto('https://www.rsmb.tv/projects?token=private#private');
    await expect.poll(() => requests.some(item => item.type === 'event' && !item.payload.name)).toBe(true);
    await page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Flights', exact: true }) }).click();
    await expect.poll(() => requests.some(item => item.payload.name === 'project-link-click')).toBe(true);
    await page.evaluate(() => {
        const error = new TypeError('private user@example.org at 38.5,-92.5');
        error.stack = 'TypeError: private details\n at https://www.rsmb.tv/assets/FlightsMap-Ab1.js:8:12';
        (window as Window & { umami?: { captureException: (error: Error) => void } }).umami?.captureException(error);
    });
    await expect.poll(() => requests.some(item => item.type === 'error')).toBe(true);
    expect(requests.find(item => item.payload.name === 'project-link-click')?.payload).toMatchObject({
        url: '/projects', data: { project: 'flights', destination: 'details', placement: 'projects' }, tag: 'rsmb-tv',
    });
    expect(requests.find(item => item.type === 'error')?.payload).toMatchObject({
        name: 'TypeError', message: 'TypeError', stack: 'at /assets/FlightsMap-Ab1.js:8:12',
    });
    expect(JSON.stringify(requests)).not.toMatch(/private|user@example|38\.5|-92\.5/i);
});
