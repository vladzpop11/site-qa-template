import { test, checkEveryPage, visit } from '../src/fixtures';
import { judgeVitals, webVitals } from '../src/judges';

/**
 * **Performance: Largest Contentful Paint and Cumulative Layout Shift** on every page, from the browser's own
 * observers, against the thresholds Google calls "good" (LCP ≤ 2.5s, CLS ≤ 0.1). One cold load per page, on this
 * machine's network: a lab signal to compare runs by, not what visitors measure in the field. LCP is unavailable in
 * WebKit and is then not judged.
 */
test('every page loads within the "good" Core Web Vitals', async ({ page }, testInfo) => {
  const seen: string[] = [];
  await checkEveryPage(testInfo, 'Core Web Vitals', async (url) => {
    await visit(page, url);
    const v = await page.evaluate(webVitals);
    seen.push(`${new URL(url).pathname}: LCP ${v.lcp === null ? 'n/a' : `${Math.round(v.lcp)}ms`}, CLS ${v.cls.toFixed(3)}, TTFB ${v.ttfb === null ? 'n/a' : `${Math.round(v.ttfb)}ms`}`);
    return judgeVitals(v);
  }).finally(() => testInfo.annotations.push({ type: 'measured', description: seen.join(' · ') }));
});
