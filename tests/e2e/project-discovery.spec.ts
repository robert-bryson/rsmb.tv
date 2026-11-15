import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { projects } from '../../src/content/projects';
import { auditAssets } from './fixtures/audit-assets';

test.beforeEach(async ({ page }) => { await auditAssets(page); });

const total = projects.length;
const totalLabel = `${total} ${total === 1 ? 'project' : 'projects'}`;
const pythonProjects = projects.filter(project => project.tech.includes('Python'));
const pythonTools = pythonProjects.filter(project => project.category === 'tools');
const tools = projects.filter(project => project.category === 'tools');

async function expectAccessible(page: Page) {
    const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    expect(audit.violations).toEqual([]);
}

for (const width of [320, 1280]) {
    test(`project discovery combines filters and restores browser history at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/projects');
        const search = page.getByRole('searchbox', { name: 'Search projects' });
        const categories = page.getByRole('navigation', { name: 'Project categories' });
        const results = page.getByRole('list', { name: 'Projects', exact: true });
        await expect(results.getByRole('heading', { level: 2 })).toHaveCount(total);

        await search.pressSequentially('python');
        await expect(search).toBeFocused();
        await expect(results.getByRole('heading', { level: 2 })).toHaveText(pythonProjects.map(project => project.title));
        await expect(page.getByRole('status')).toHaveText(`${pythonProjects.length} of ${totalLabel}`);
        await expect(categories.getByRole('link', { name: 'Maps & data' })).toHaveAttribute('href', '/projects?category=maps&q=python');
        await categories.getByRole('link', { name: 'Command line' }).click();
        await expect(page.getByRole('status')).toHaveText(`${pythonTools.length} of ${totalLabel}`);
        await expect(results.getByRole('heading', { level: 2 })).toHaveText(pythonTools.map(project => project.title));
        await expect(categories.getByRole('link', { name: 'Command line' })).toHaveAccessibleDescription(`${pythonTools.length} matching projects`);

        await page.reload();
        await expect(search).toHaveValue('python');
        await expect(categories.getByRole('link', { name: 'Command line' })).toHaveAttribute('aria-current', 'page');
        await results.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Anki Artisan', exact: true }) }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Anki Artisan', exact: true })).toBeVisible();
        await page.goBack();
        await expect(search).toHaveValue('python');
        await expect(page.getByRole('status')).toHaveText(`${pythonTools.length} of ${totalLabel}`);
        await page.goBack();
        await expect(page).toHaveURL(/\/projects\?q=python$/);
        await expect(page.getByRole('status')).toHaveText(`${pythonProjects.length} of ${totalLabel}`);
        await page.goForward();
        await expect(page.getByRole('status')).toHaveText(`${pythonTools.length} of ${totalLabel}`);

        await search.fill('no matching project');
        await expect(page.getByText('No projects match these filters.')).toBeVisible();
        await expect(page.getByRole('status')).toHaveText(`0 of ${totalLabel}`);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        await expectAccessible(page);

        await search.press('Tab');
        await expect(page.getByRole('button', { name: 'Clear search' })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(search).toHaveValue('');
        await expect(search).toBeFocused();
        await expect(page.getByRole('status')).toHaveText(`${tools.length} of ${totalLabel}`);
        await page.getByRole('button', { name: 'Clear all filters' }).click();
        await expect(page).toHaveURL(/\/projects$/);
        await expect(search).toBeFocused();
        await expect(results.getByRole('heading', { level: 2 })).toHaveCount(total);
    });

    test(`project cards provide distinct actions and readable previews at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/projects');
        const results = page.getByRole('list', { name: 'Projects', exact: true });
        const map = results.getByRole('link', { name: 'Open map: Pins of Inaccessibility', exact: true });
        await expect(map).toHaveAttribute('href', '/projects/pins-of-inaccessibility/map');
        await expect(map).not.toHaveAttribute('target');
        const demo = results.getByRole('link', { name: 'Live demo: Through Routes (opens in a new tab)', exact: true });
        await expect(demo).toHaveAttribute('href', 'https://through-routes.rsmb.tv/');
        const source = results.getByRole('link', { name: 'Source: Through Routes (opens in a new tab)', exact: true });
        await expect(source).toHaveAttribute('href', 'https://github.com/robert-bryson/through-routes');
        for (const link of [source, demo]) {
            await expect(link).toHaveAttribute('target', '_blank');
            await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        }
        await expect(results.locator('a a')).toHaveCount(0);
        const preview = results.locator('img').first();
        await expect.poll(() => preview.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        await expect(preview).toHaveAttribute('sizes', '(min-width: 640px) 192px, calc(100vw - 5rem)');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        await expectAccessible(page);
    });

    test(`project search defers map data until the map action is used at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const requests: string[] = [];
        const isFlightData = (url: string) => new URL(url).pathname === '/data/flights/flights.geojson';
        page.on('request', request => { if (isFlightData(request.url())) requests.push(request.url()); });
        await page.goto('/projects');
        await page.getByRole('searchbox', { name: 'Search projects' }).pressSequentially('flights');
        await expect(page.getByRole('list', { name: 'Projects', exact: true }).getByRole('heading', { level: 2 })).toHaveText(['Flights']);
        expect(requests).toEqual([]);
        const mapRequest = page.waitForRequest(request => isFlightData(request.url()));
        await page.getByRole('link', { name: 'Open map: Flights', exact: true }).click();
        await mapRequest;
        await expect(page).toHaveURL(/\/projects\/flights\/map$/);
        expect(requests.length).toBeGreaterThan(0);
    });

    test(`@a11y projects search retains visible keyboard focus in forced colors at ${width}px`, async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Forced-color emulation requires Chromium.');
        await page.emulateMedia({ forcedColors: 'active' });
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/projects');
        const search = page.getByRole('searchbox', { name: 'Search projects' });
        await search.focus();
        await expect(search).toBeFocused();
        const outline = await search.evaluate(element => {
            const style = getComputedStyle(element);
            return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
        });
        expect(outline.style).not.toBe('none');
        expect(outline.width).toBeGreaterThanOrEqual(2);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    });
}
