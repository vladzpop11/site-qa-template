import { test, expect, visit } from '../src/fixtures';
import { config } from '../src/config';
import { isAllowed } from '../src/guard';
import { readPages } from '../src/sitemap';

/**
 * **Links and mixed content.** Every link on the listed pages is collected. Links to allowed hosts are requested once
 * each (at most `MAX_LINKS`, default 150), and a 4xx/5xx is reported with the page it was found on. Links to other
 * sites are counted, never requested. On an https page, any subresource loaded over plain http is reported as mixed
 * content. Runs once, in the desktop project.
 */
const MAX_LINKS = Number(process.env.MAX_LINKS || 150);

test('every link on the site resolves, and https pages load nothing over http', async ({ page, request }, testInfo) => {
  test.skip(!!testInfo.project.use.isMobile, 'links are checked once, in the desktop project');
  const cfg = config();
  const pages = readPages();
  test.setTimeout(Math.max(120_000, pages.length * 30_000 + MAX_LINKS * 3_000));
  const foundOn = new Map<string, string>();
  const mixed: string[] = [];
  let external = 0;
  page.on('request', (r) => {
    if (page.url().startsWith('https:') && r.url().startsWith('http:')) mixed.push(`${new URL(page.url()).pathname}: ${r.resourceType()} over http: ${r.url().slice(0, 120)}`);
  });
  for (const url of pages) {
    await test.step(`collect links on ${new URL(url).pathname}`, async () => {
      await visit(page, url).catch(() => {});
      const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => (a as HTMLAnchorElement).href));
      for (const href of hrefs) {
        if (!/^https?:/.test(href)) continue;
        const clean = href.split('#')[0];
        if (!isAllowed(clean, cfg)) external += 1;
        else if (!foundOn.has(clean)) foundOn.set(clean, new URL(url).pathname || '/');
      }
    });
  }
  const targets = [...foundOn.keys()].slice(0, MAX_LINKS);
  expect(targets.length, 'non-vacuity: the pages carry links to check').toBeGreaterThan(0);
  const broken: string[] = [];
  for (const target of targets) {
    const res = await request.get(target, { failOnStatusCode: false, maxRedirects: 5, timeout: 30_000 }).catch(() => null);
    const status = res ? res.status() : 0;
    if (status === 0 || status >= 400) broken.push(`${target} → ${status || 'no answer'} (linked from ${foundOn.get(target)})`);
  }
  testInfo.annotations.push({ type: 'links', description: `${targets.length} checked on allowed hosts${foundOn.size > targets.length ? ` (of ${foundOn.size}; raise MAX_LINKS for more)` : ''}; ${external} to other sites, not requested` });
  expect([...broken, ...new Set(mixed)], `${broken.length} broken link(s), ${new Set(mixed).size} mixed-content load(s)`).toEqual([]);
});
