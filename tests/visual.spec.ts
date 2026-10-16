import { test, expect, visit } from '../src/fixtures';
import { readPages } from '../src/sitemap';

/**
 * **Visual snapshots: what each page looked like when you approved it.** The first run has no baselines and fails,
 * saying so. Look at the pages, then record them with `npm run baseline`. A baseline is an approval, so record it only
 * after looking. Later runs fail where a page changed by more than 1% of its pixels. Dynamic content (dates, carousels,
 * ads) will differ between runs; mask it in your copy of this file when it does.
 */
test('every page looks as it did when its baseline was approved', async ({ page }, testInfo) => {
  const pages = readPages();
  test.setTimeout(Math.max(60_000, pages.length * 45_000));
  for (const url of pages) {
    const name = (new URL(url).pathname.replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-') || 'home') + '.png';
    await test.step(name, async () => {
      await visit(page, url);
      await expect.soft(page, `${new URL(url).pathname} changed since its baseline`).toHaveScreenshot(name, { fullPage: true });
    });
  }
  testInfo.annotations.push({ type: 'pages', description: String(pages.length) });
});
