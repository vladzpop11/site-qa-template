import { test, checkEveryPage, visit } from '../src/fixtures';

/**
 * **No JavaScript errors** while each page loads: uncaught exceptions (`pageerror`) and `console.error` messages,
 * whoever's script raised them, because the site ships every script it loads. Failed requests for the page's own
 * resources are counted too (a 4xx/5xx for a script, stylesheet, image or font on an allowed host).
 */
test('every page loads without JavaScript errors or broken resources', async ({ page, stoppedNavigations }, testInfo) => {
  let errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`uncaught: ${e.message.split('\n')[0].slice(0, 160)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text().split('\n')[0].slice(0, 160)}`);
  });
  page.on('response', (r) => {
    const type = r.request().resourceType();
    if (r.status() >= 400 && ['script', 'stylesheet', 'image', 'font', 'fetch', 'xhr'].includes(type)) errors.push(`${type} ${r.status()}: ${r.url().slice(0, 120)}`);
  });
  await checkEveryPage(testInfo, 'errors while loading', async (url) => {
    errors = [];
    await visit(page, url);
    await page.waitForTimeout(1000); // late errors from deferred scripts
    return [...new Set(errors)];
  });
  if (stoppedNavigations.length) testInfo.annotations.push({ type: 'navigations stopped at the allow-list', description: stoppedNavigations.join(' · ') });
});
