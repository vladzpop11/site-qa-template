import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { config } from '../src/config';
import { PAGES_FILE, collectPages } from '../src/sitemap';

/**
 * **The page list, read from the site itself.** Runs before every check project. It reads `PAGES` if given, otherwise
 * the sitemap (indexes followed), drops anything on a host that is not allowed, spreads the `MAX_PAGES` cap evenly
 * across the site, and writes `.pages.json`.
 */
test('collect the pages to check', async ({ request }, testInfo) => {
  const cfg = config();
  const { pages, source, dropped, sitemapsRead } = await collectPages(request, cfg);
  expect(pages.length, 'non-vacuity: at least the target page').toBeGreaterThan(0);
  fs.writeFileSync(PAGES_FILE, JSON.stringify({ target: cfg.targetUrl.href, source, pages, collectedAt: new Date().toISOString() }, null, 2));
  testInfo.annotations.push({ type: 'pages', description: `${pages.length} from ${source}; ${dropped} entr(ies) on other hosts dropped; ${sitemapsRead} sitemap file(s) read` });
  console.log(`      ${pages.length} page(s) from ${source}${dropped ? `, ${dropped} on other hosts dropped, never requested` : ''}`);
});
