import { test, expect } from '@playwright/test';
import { judgeCookies, judgeHeaders, judgeSeo, judgeVitals, type SeoFacts } from '../src/judges';

/** Every rule flags what it is written to flag, and passes a clean example. Offline. */
test.describe('selftest: the rules', () => {
  test('headers: a complete set passes, an empty one names every gap', () => {
    const good = {
      'Strict-Transport-Security': 'max-age=31536000',
      'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };
    expect(judgeHeaders(good, true)).toEqual([]);
    expect(judgeHeaders({ 'x-frame-options': 'DENY', 'content-security-policy': "default-src 'self'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' }, false)).toEqual([]);
    const bad = judgeHeaders({ 'X-Powered-By': 'Express' }, true);
    expect(bad).toHaveLength(6);
    expect(bad.join(' ')).toMatch(/Strict-Transport-Security.*Content-Security-Policy.*nosniff.*framing.*Referrer-Policy.*Express/);
    expect(judgeHeaders({}, false).some((p) => /Strict-Transport/.test(p)), 'HSTS is not asked of http').toBe(false);
  });

  test('cookies: Secure, SameSite, and HttpOnly on session-like names', () => {
    expect(judgeCookies(['a=1; Path=/; Secure; SameSite=Lax', 'session_id=x; Secure; HttpOnly; SameSite=Strict'], true)).toEqual([]);
    expect(judgeCookies(['a=1; Path=/'], true)).toEqual(['cookie "a" is not Secure', 'cookie "a" sets no SameSite']);
    expect(judgeCookies(['sessionid=x; Secure; SameSite=Lax'], true)).toEqual(['cookie "sessionid" looks like a session but is not HttpOnly']);
    expect(judgeCookies(['a=1; SameSite=Lax'], false), 'Secure is not asked of http').toEqual([]);
  });

  test('search basics: a complete page passes, an empty one names every gap', () => {
    const good: SeoFacts = { title: 'Shoes — Example', description: 'All our shoes.', canonical: '/shoes', h1: 1, lang: 'en', robots: null, viewport: 'width=device-width' };
    expect(judgeSeo(good)).toEqual([]);
    const bad = judgeSeo({ title: '', description: null, canonical: null, h1: 0, lang: '', robots: 'noindex', viewport: null });
    expect(bad).toHaveLength(7);
    expect(judgeSeo({ ...good, title: 'x'.repeat(80) })[0]).toMatch(/80 characters/);
    expect(judgeSeo({ ...good, h1: 2 })[0]).toMatch(/2 <h1>/);
  });

  test('vitals: within "good" passes, beyond it is named, an unmeasured LCP is not judged', () => {
    expect(judgeVitals({ lcp: 1200, cls: 0.05 })).toEqual([]);
    expect(judgeVitals({ lcp: 4000, cls: 0.3 })).toHaveLength(2);
    expect(judgeVitals({ lcp: null, cls: 0 })).toEqual([]);
  });
});
