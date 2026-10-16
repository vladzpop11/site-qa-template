import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import { config } from './config';
import { assertAllowed, guardNavigations, isAllowed } from './guard';
import { readPages } from './sitemap';

/**
 * **The fixture every check uses.** Each test's browser context is guarded (`guardNavigations`), so a navigation that
 * leaves the allowed hosts is stopped and reported. `visit` opens a page only on an allowed host, and fails on an error
 * status, on a page that ends up on another host, and on a blank document, so no check measures an error page or
 * nothing.
 */
export const test = base.extend<{ stoppedNavigations: string[] }>({
  stoppedNavigations: [
    async ({ context }, use) => {
      const stopped = await guardNavigations(context, config());
      await use(stopped);
    },
    { auto: true },
  ],
});
export { expect };

export async function visit(page: Page, url: string): Promise<void> {
  const cfg = config();
  assertAllowed(url, cfg, 'navigation');
  let res = await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
  // One polite retry when the site sheds load (429) or is briefly unavailable (503); a second refusal is reported.
  if (res && [429, 503].includes(res.status())) {
    await page.waitForTimeout(5_000);
    res = await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
  }
  if (!res) throw new Error(`no response for ${url}`);
  if (res.status() >= 400) throw new Error(`${url} answered ${res.status()}${res.status() === 503 ? ' (unavailable: maintenance or overload; rerun later)' : ''}`);
  if (!isAllowed(page.url(), cfg)) throw new Error(`${url} ended on ${page.url()}, outside ALLOWED_HOSTS`);
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
  const text = await page.evaluate(() => document.body?.innerText.trim().length ?? 0);
  if (text === 0) throw new Error(`${url} rendered no text, so nothing on it could be judged`);
}

/**
 * Run `check` on every listed page, one step each, and fail once at the end with every problem found, each prefixed by
 * the page's path. A page that cannot be opened is a problem too, not a reason to stop. Fails if no page was checked.
 */
export async function checkEveryPage(testInfo: TestInfo, what: string, check: (url: string) => Promise<string[]>): Promise<void> {
  const pages = readPages();
  test.setTimeout(Math.max(60_000, pages.length * 45_000));
  const problems: string[] = [];
  let checked = 0;
  for (const url of pages) {
    const where = new URL(url).pathname || '/';
    await test.step(where, async () => {
      try {
        const found = await check(url);
        checked += 1;
        problems.push(...found.map((p) => `${where}: ${p}`));
      } catch (error) {
        problems.push(`${where}: could not be checked: ${String((error as Error).message).split('\n')[0]}`);
      }
    });
  }
  testInfo.annotations.push({ type: 'pages checked', description: `${checked} of ${pages.length}` });
  expect(checked, 'non-vacuity: no page could be checked').toBeGreaterThan(0);
  expect(problems, `${what}: ${problems.length} problem(s) on ${checked} page(s)`).toEqual([]);
}

/** Problems that repeat on every page, folded into one line each with the pages they were seen on. */
export function grouped(perPage: Array<{ page: string; problems: string[] }>): string[] {
  const by = new Map<string, string[]>();
  for (const { page, problems } of perPage) for (const p of problems) by.set(p, [...(by.get(p) ?? []), page]);
  return [...by.entries()].map(([p, pages]) => `${p} (on ${pages.length} of ${perPage.length} page(s): ${pages.slice(0, 3).join(', ')}${pages.length > 3 ? ', …' : ''})`);
}
