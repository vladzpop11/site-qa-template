import { test, checkEveryPage, visit } from '../src/fixtures';
import { layoutFacts } from '../src/judges';

/**
 * **Layout.** On the desktop project: every page reflows at 320 CSS px with no horizontal scrolling (WCAG 1.4.10
 * Reflow, AA, which equals 1280px at 400% zoom). On the phone projects: no horizontal overflow at the phone's own
 * width, and no interactive target smaller than 24×24 CSS px (WCAG 2.5.8 Target Size Minimum, AA; inline links in
 * running text are exempt and skipped).
 */
test('every page reflows at 320px without horizontal scrolling', async ({ page }, testInfo) => {
  test.skip(!!testInfo.project.use.isMobile, 'reflow is measured once, on the desktop project at 320px');
  await page.setViewportSize({ width: 320, height: 800 });
  await checkEveryPage(testInfo, 'horizontal scrolling at 320px', async (url) => {
    await visit(page, url);
    const f = await page.evaluate(layoutFacts);
    return f.scrollWidth > f.clientWidth + 1 ? [`${f.scrollWidth}px wide at 320px; overflowing: ${f.overflowing.join(', ') || 'not traced'}`] : [];
  });
});

test('on a phone every page fits the screen and its targets are at least 24×24px', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.isMobile, 'phone layout runs on the phone projects');
  await checkEveryPage(testInfo, 'phone layout', async (url) => {
    await visit(page, url);
    const f = await page.evaluate(layoutFacts);
    const problems: string[] = [];
    if (f.scrollWidth > f.clientWidth + 1) problems.push(`${f.scrollWidth}px wide on a ${f.clientWidth}px screen; overflowing: ${f.overflowing.join(', ') || 'not traced'}`);
    if (f.smallTargets.length) problems.push(`targets under 24×24px: ${f.smallTargets.join('; ')}`);
    return problems;
  });
});
