import { test, expect } from '../src/fixtures';
import { config } from '../src/config';
import { assertAllowed } from '../src/guard';
import { readPages } from '../src/sitemap';
import { judgeCookies, judgeHeaders } from '../src/judges';
import { grouped } from '../src/fixtures';

/**
 * **Security headers and cookies, read passively.** One plain GET per page, the same request a browser makes; nothing
 * is sent that a visitor would not send. Missing protections are reported (HSTS, CSP, nosniff, framing, Referrer-Policy,
 * a disclosing X-Powered-By), and cookies without Secure or SameSite, or session-like cookies without HttpOnly.
 * Problems shared by every page are folded into one line. Runs once, in the desktop project: headers do not depend on
 * the device.
 */
test('every page sends the basic security headers and safe cookies', async ({ request }, testInfo) => {
  test.skip(!!testInfo.project.use.isMobile, 'headers are read once, in the desktop project');
  const cfg = config();
  const pages = readPages();
  const perPage: Array<{ page: string; problems: string[] }> = [];
  for (const url of pages) {
    assertAllowed(url, cfg);
    const res = await request.get(url, { failOnStatusCode: false, maxRedirects: 5 });
    const headers = Object.fromEntries(res.headersArray().map((h) => [h.name.toLowerCase(), h.value]));
    const cookies = res.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie').map((h) => h.value);
    const https = new URL(res.url()).protocol === 'https:';
    perPage.push({ page: new URL(url).pathname || '/', problems: res.status() >= 400 ? [`answered ${res.status()}`] : [...judgeHeaders(headers, https), ...judgeCookies(cookies, https)] });
  }
  expect(perPage.length, 'non-vacuity: pages were read').toBeGreaterThan(0);
  const problems = grouped(perPage);
  testInfo.annotations.push({ type: 'pages read', description: String(perPage.length) });
  expect(problems, `missing protections on ${perPage.length} page(s)`).toEqual([]);
});
