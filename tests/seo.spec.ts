import { test, expect, checkEveryPage, visit } from '../src/fixtures';
import { config } from '../src/config';
import { judgeSeo, seoFacts } from '../src/judges';

/**
 * **Search basics on every page**, in the rendered page (after scripts ran): a title of sensible length, a meta
 * description, a canonical link, exactly one h1, a lang on <html>, a viewport meta, and no unexpected noindex. Plus,
 * once, a robots.txt and a sitemap at the usual places. Runs once, in the desktop project.
 */
test('every page carries the search basics', async ({ page }, testInfo) => {
  test.skip(!!testInfo.project.use.isMobile, 'search basics are checked once, in the desktop project');
  await checkEveryPage(testInfo, 'search basics', async (url) => {
    await visit(page, url);
    return judgeSeo(await page.evaluate(seoFacts));
  });
});

test('the site publishes robots.txt and a sitemap', async ({ request }, testInfo) => {
  test.skip(!!testInfo.project.use.isMobile, 'checked once, in the desktop project');
  const cfg = config();
  const robots = await request.get(new URL('/robots.txt', cfg.targetUrl).href, { failOnStatusCode: false });
  const sitemap = await request.get(cfg.sitemapUrl.href, { failOnStatusCode: false });
  const problems: string[] = [];
  if (robots.status() !== 200) problems.push(`robots.txt answered ${robots.status()}`);
  if (sitemap.status() !== 200) problems.push(`${cfg.sitemapUrl.pathname} answered ${sitemap.status()}`);
  else if (!/<(urlset|sitemapindex)[\s>]/i.test(await sitemap.text())) problems.push(`${cfg.sitemapUrl.pathname} is not a sitemap`);
  expect(problems).toEqual([]);
});
