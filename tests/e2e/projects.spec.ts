import { expect, test } from '@playwright/test';
import { projects } from '../../src/content/projects';

for (const width of [320, 1280]) {
    test(`project dates and changelogs remain readable at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/projects');

        for (const project of projects) {
            const card = page.getByRole('link').filter({
                has: page.getByRole('heading', { name: project.title, exact: true }),
            });
            await expect(card).toHaveAttribute('href', `/projects/${project.slug}`);
            await expect(card.getByRole('time')).toHaveAttribute('datetime', project.lastUpdated!);
            await expect(card).toContainText('Updated');
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

        await page.getByRole('link').filter({
            has: page.getByRole('heading', { name: 'Through Routes', exact: true }),
        }).click();
        await expect(page.getByRole('heading', { name: 'Changelog', exact: true })).toBeVisible();

        const entries = page.locator('dl > div');
        const changelog = projects.find(project => project.slug === 'through-routes')!.changelog!;
        await expect(entries).toHaveCount(changelog.length);

        for (const [index, entry] of changelog.entries()) {
            const row = entries.nth(index);
            await expect(row.getByRole('time')).toHaveAttribute('datetime', entry.date);
            await expect(row.getByRole('listitem')).toHaveText(entry.notes);
            await expect(row.getByRole('list')).toHaveCSS('list-style-type', 'disc');

            const layout = await row.evaluate(element => {
                const date = element.querySelector('dt')!.getBoundingClientRect();
                const notes = element.querySelector('dd')!.getBoundingClientRect();
                return { dateBottom: date.bottom, dateRight: date.right, notesTop: notes.top, notesLeft: notes.left };
            });
            if (width < 640) {
                expect(layout.notesTop).toBeGreaterThanOrEqual(layout.dateBottom);
            } else {
                expect(layout.notesLeft).toBeGreaterThan(layout.dateRight);
            }
        }

        if (width === 320) {
            const lines = await entries.first().getByRole('listitem').first().evaluate(element => {
                const range = document.createRange();
                range.selectNodeContents(element);
                return [...range.getClientRects()].map(rect => ({ left: rect.left, top: rect.top }));
            });
            expect(new Set(lines.map(line => line.top)).size).toBeGreaterThan(1);
            expect(Math.max(...lines.map(line => line.left)) - Math.min(...lines.map(line => line.left))).toBeLessThan(1);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
}
