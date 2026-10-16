import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { WCAG_TAGS, layoutFacts, seoFacts, webVitals } from '../src/judges';

/**
 * The in-page checks on pages built here, offline: each catches a planted fault and passes the same page without it.
 * A broken probe and a clean site give the same green, which is why these exist.
 */
const page = (body: string, head = '<title>Selftest</title>') => `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width">${head}</head><body><main>${body}</main></body></html>`;

test.describe('selftest: the in-page checks', () => {
  test('axe flags an image without alt text, and passes the page once it has one', async ({ page: p }) => {
    await p.setContent(page('<h1>Shop</h1><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="10" height="10">'));
    const bad = await new AxeBuilder({ page: p }).withTags(WCAG_TAGS).analyze();
    expect(bad.violations.map((v) => v.id)).toContain('image-alt');
    await p.setContent(page('<h1>Shop</h1><img alt="A shoe" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="10" height="10">'));
    const good = await new AxeBuilder({ page: p }).withTags(WCAG_TAGS).analyze();
    expect(good.violations).toEqual([]);
    expect(good.passes.length, 'non-vacuity: axe judged the page').toBeGreaterThanOrEqual(5);
  });

  test('reflow: a 1000px-wide block overflows at 320px, a fluid one does not', async ({ page: p }) => {
    await p.setViewportSize({ width: 320, height: 600 });
    await p.setContent(page('<h1>Wide</h1><div id="wide" style="width:1000px">too wide</div>'));
    const bad = await p.evaluate(layoutFacts);
    expect(bad.scrollWidth).toBeGreaterThan(bad.clientWidth + 1);
    expect(bad.overflowing.join(' ')).toContain('div#wide');
    await p.setContent(page('<h1>Fluid</h1><div style="max-width:100%">fits</div>'));
    const good = await p.evaluate(layoutFacts);
    expect(good.scrollWidth).toBeLessThanOrEqual(good.clientWidth + 1);
  });

  test('targets: a 16px button crowded by another is too small, a 44px one is fine, an inline link in text is exempt', async ({ page: p }) => {
    await p.setViewportSize({ width: 390, height: 800 });
    await p.setContent(
      page(`<h1>Targets</h1>
        <div style="display:flex;gap:2px">
          <button id="tiny" style="width:16px;height:16px;padding:0;border:0">x</button>
          <button id="big" style="width:44px;height:44px">ok</button>
        </div>
        <p>Read our long and helpful explanation about shoes and their many uses in the <a href="/t">terms</a> today.</p>`),
    );
    const f = await p.evaluate(layoutFacts);
    expect(f.smallTargets.join(' ')).toContain('button#tiny');
    expect(f.smallTargets.join(' ')).not.toContain('button#big');
    expect(f.smallTargets.join(' ')).not.toContain('terms');
  });

  test('targets: an undersized target with room around it passes (2.5.8 spacing), crowded ones fail', async ({ page: p }) => {
    await p.setViewportSize({ width: 390, height: 800 });
    await p.setContent(
      page(`<h1>Spacing</h1>
        <div style="position:relative;height:200px">
          <a id="alone" href="/a" style="position:absolute;left:20px;top:20px;display:block;width:16px;height:16px">a</a>
          <a id="pair1" href="/b" style="position:absolute;left:20px;top:100px;display:block;width:16px;height:16px">b</a>
          <a id="pair2" href="/c" style="position:absolute;left:40px;top:100px;display:block;width:16px;height:16px">c</a>
        </div>`),
    );
    const f = await p.evaluate(layoutFacts);
    const flagged = f.smallTargets.join(' ');
    expect(flagged, 'a lone 16px link with space around it meets the spacing exception').not.toContain('a#alone');
    expect(flagged, 'two 16px links 20px apart are too crowded').toContain('a#pair1');
    expect(flagged).toContain('a#pair2');
  });

  test('search facts are read from the rendered page', async ({ page: p }) => {
    await p.setContent(page('<h1>One</h1>', '<title>Shoes</title><meta name="description" content="All shoes"><link rel="canonical" href="https://www.example.test/shoes">'));
    expect(await p.evaluate(seoFacts)).toEqual({ title: 'Shoes', description: 'All shoes', canonical: 'https://www.example.test/shoes', h1: 1, lang: 'en', robots: null, viewport: 'width=device-width' });
  });

  test('vitals are collected: a layout shift is counted', async ({ page: p }) => {
    /**
     * Loaded as a real page (served offline by a route), not with setContent: measured 2026-10-16, a document written by
     * setContent does not replay past layout shifts to a late observer, while a navigated page does, and real sites are
     * navigated. The first version of this test used setContent and reported 0 for a shift that had happened.
     */
    await p.route('https://vitals.selftest/', (r) => r.fulfill({ contentType: 'text/html', body: page('<h1>Shift</h1><div id="push"></div><p>text that moves</p>') }));
    await p.goto('https://vitals.selftest/');
    await p.waitForTimeout(300);
    await p.evaluate(() => {
      (document.getElementById('push') as HTMLElement).style.height = '300px';
    });
    await p.waitForTimeout(500);
    const v = await p.evaluate(webVitals);
    expect(v.cls, 'the planted shift was observed').toBeGreaterThan(0);
    expect(v.lcp, 'a largest contentful paint was observed').not.toBeNull();
  });
});
