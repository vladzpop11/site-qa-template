import { AxeBuilder } from '@axe-core/playwright';
import { test, checkEveryPage, visit } from '../src/fixtures';
import { WCAG_TAGS } from '../src/judges';

/**
 * **Accessibility: axe on every listed page**, against WCAG 2.0–2.2 Level A and AA (`wcag2a`, `wcag2aa`, `wcag21a`,
 * `wcag21aa`, `wcag22aa`). Runs in every project, so the phone layout is judged too.
 *
 * axe finds roughly a third to a half of what a person with assistive technology meets. A clean result is not
 * conformance. Non-vacuity: a page on which axe passed fewer than five rules is reported, because it judged next to
 * nothing (a blank or blocked page).
 */
test('every page passes axe at WCAG A and AA', async ({ page }, testInfo) => {
  await checkEveryPage(testInfo, 'axe violations', async (url) => {
    await visit(page, url);
    const r = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    if (r.passes.length < 5) return [`axe passed only ${r.passes.length} rule(s): it judged next to nothing`];
    return r.violations.map(
      (v) => `${v.id} (${v.impact}, ${v.tags.filter((t) => /^wcag\d{3,}$/.test(t)).join(' ')}) ×${v.nodes.length}: ${v.help} → ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`,
    );
  });
});
