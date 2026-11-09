import { expect, test, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { measurePrefetch } from '../../scripts/measure-prefetch.js';

// The fixture requires trusted input and keeps a destination incomplete for
// 250 ms. A source heading or an empty canvas must not finish a measurement.
const fixture = `<!doctype html><main></main><script>
window.fixtureVisits = 0;
const main = document.querySelector('main');
function source() {
    const href = location.pathname.includes('flights') ? '/projects/flights/map' : '/about';
    main.innerHTML = '<h1>Source</h1><a href="' + href + '">Open destination</a>';
    main.querySelector('a').addEventListener('click', event => {
        event.preventDefault();
        if (!event.isTrusted) throw new Error('Synthetic activation cannot measure input delay');
        history.pushState({}, '', href);
        window.fixtureVisits++;
        main.innerHTML = href === '/about' ? '<h1 style="visibility:hidden">About</h1>'
            : '<div role="application" aria-label="showing 0 flights"><div class="flights-globe"><canvas></canvas></div></div><div id="loading">Loading globe...</div>';
        setTimeout(() => {
            if (href === '/about') main.querySelector('h1').style.visibility = 'visible';
            else {
                main.querySelector('[role="application"]').setAttribute('aria-label', 'showing 1 flights');
                document.querySelector('#loading').remove();
            }
            window.fixtureReadyAt = performance.now();
        }, 250);
    });
}
addEventListener('popstate', source);
source();
</script>`;

interface Observation {
    fixtureReadyAt: number;
    fixtureVisits: number;
    readyAt: number;
    inputTime: number;
}

for (const warm of [false, true]) {
    test(`prefetch timing uses browser readiness and trusted input (${warm ? 'return visit' : 'first visit'})`, async ({ browser }, testInfo) => {
        const server = createServer((_request, response) => {
            response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(fixture);
        });
        await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('Fixture did not bind a port');
        const observations: Observation[] = [];
        const adapter = {
            version: () => browser.version(),
            newContext: async (options: Parameters<typeof browser.newContext>[0]) => {
                const context = await browser.newContext(options);
                context.on('page', page => {
                    const waitForFunction = page.waitForFunction.bind(page);
                    // Deliberately delay the test runner. Its polling and transport
                    // delay must not become part of the browser's ready timestamp.
                    page.waitForFunction = (async (...args: Parameters<Page['waitForFunction']>) => {
                        const handle = await waitForFunction(...args);
                        await new Promise(resolve => setTimeout(resolve, 600));
                        return handle;
                    }) as Page['waitForFunction'];
                });
                const close = context.close.bind(context);
                context.close = async options => {
                    try {
                        observations.push(await context.pages()[0].evaluate<Observation>(`({
                            fixtureReadyAt: window.fixtureReadyAt,
                            fixtureVisits: window.fixtureVisits,
                            readyAt: window.__prefetchMeasure.readyAt,
                            inputTime: window.__prefetchMeasure.input.timeStamp
                        })`));
                    } finally { await close(options); }
                };
                return context;
            },
        };
        try {
            const report = await measurePrefetch({ baseURL: `http://127.0.0.1:${address.port}`, label: 'fixture',
                out: testInfo.outputPath('measurement.json'), samples: 1, hovers: [0], warm }, { browser: adapter });
            expect(report.measurementVersion).toBe(2);
            expect(report.results).toHaveLength(2);
            expect(observations).toHaveLength(2);
            for (const [index, result] of report.results.entries()) {
                const observation = observations[index];
                expect(result.trustedInput).toBe(true);
                expect(result.errors).toEqual([]);
                expect(observation.fixtureVisits).toBe(warm ? 2 : 1);
                expect(result.readyAt).toBeGreaterThanOrEqual(observation.fixtureReadyAt);
                expect(result.clickToReadyMs).toBeGreaterThanOrEqual(250);
                expect(result.readyAt).toBe(observation.readyAt);
                expect(result.clickToReadyMs).toBeCloseTo(result.readyAt - result.activationAt, 5);
                // The native input timestamp and the epoch used to dispatch it
                // differ only by browser timer precision, even after delayed polling.
                expect(Math.abs(result.activationAt - observation.inputTime)).toBeLessThan(2);
            }
        } finally {
            server.closeAllConnections();
            await new Promise<void>(resolve => server.close(() => resolve()));
        }
    });
}
