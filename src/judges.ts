/**
 * **The rules each check applies, as plain functions**, so the selftests can prove them on planted examples without a
 * network. What a rule asks for, and why, is written beside it. Each returns a list of problems; empty means it passed.
 */

/** Response headers a site should send on its pages. Missing ones are reported; the values are not judged in depth. */
export function judgeHeaders(headers: Record<string, string>, isHttps: boolean): string[] {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const problems: string[] = [];
  if (isHttps && !h['strict-transport-security']) problems.push('no Strict-Transport-Security: browsers may be downgraded to http');
  if (!h['content-security-policy']) problems.push('no Content-Security-Policy');
  if ((h['x-content-type-options'] ?? '').toLowerCase() !== 'nosniff') problems.push('X-Content-Type-Options is not "nosniff"');
  const framing = /frame-ancestors/i.test(h['content-security-policy'] ?? '') || /^(deny|sameorigin)$/i.test(h['x-frame-options'] ?? '');
  if (!framing) problems.push('no framing protection (CSP frame-ancestors or X-Frame-Options): the page can be embedded by any site');
  if (!h['referrer-policy']) problems.push('no Referrer-Policy');
  if (h['x-powered-by']) problems.push(`X-Powered-By discloses "${h['x-powered-by']}"`);
  return problems;
}

/** `Set-Cookie` lines: on https every cookie should be Secure; every cookie should say SameSite. HttpOnly is reported only for names that look like sessions. */
export function judgeCookies(setCookies: string[], isHttps: boolean): string[] {
  const problems: string[] = [];
  for (const line of setCookies) {
    const name = line.split('=')[0].trim();
    const attrs = line.toLowerCase();
    if (isHttps && !/;\s*secure/.test(attrs)) problems.push(`cookie "${name}" is not Secure`);
    if (!/;\s*samesite=/.test(attrs)) problems.push(`cookie "${name}" sets no SameSite`);
    if (/sess|auth|token|sid/i.test(name) && !/;\s*httponly/.test(attrs)) problems.push(`cookie "${name}" looks like a session but is not HttpOnly`);
  }
  return problems;
}

export type SeoFacts = {
  title: string;
  description: string | null;
  canonical: string | null;
  h1: number;
  lang: string;
  robots: string | null;
  viewport: string | null;
};

/** Collected in the page; `page.evaluate(seoFacts)`. */
export function seoFacts(): SeoFacts {
  const meta = (name: string) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null;
  return {
    title: document.title.trim(),
    description: meta('description'),
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
    h1: document.querySelectorAll('h1').length,
    lang: document.documentElement.getAttribute('lang') ?? '',
    robots: meta('robots'),
    viewport: meta('viewport'),
  };
}

export function judgeSeo(f: SeoFacts): string[] {
  const problems: string[] = [];
  if (!f.title) problems.push('no <title>');
  else if (f.title.length > 65) problems.push(`the title is ${f.title.length} characters; search results cut it near 60`);
  if (!f.description?.trim()) problems.push('no meta description');
  if (!f.canonical) problems.push('no canonical link');
  if (f.h1 !== 1) problems.push(`${f.h1} <h1> elements; one names the page`);
  if (!f.lang) problems.push('no lang on <html> (also WCAG 3.1.1, A)');
  if (/noindex/i.test(f.robots ?? '')) problems.push('the page asks not to be indexed (robots noindex): intended?');
  if (!f.viewport) problems.push('no viewport meta: phones render it as a shrunken desktop page');
  return problems;
}

export type LayoutFacts = { scrollWidth: number; clientWidth: number; overflowing: string[]; smallTargets: string[] };

/**
 * Collected in the page. Horizontal overflow (WCAG 1.4.10 Reflow at 320px), and, at phone width, interactive targets
 * smaller than 24×24 CSS px that also fail 2.5.8's spacing exception (WCAG 2.5.8, AA). Inline links inside text are
 * exempt from 2.5.8 and skipped here.
 */
export function layoutFacts(): LayoutFacts {
  const doc = document.documentElement;
  const label = (el: Element) =>
    `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 30)}"`;
  const overflowing = [...document.body.querySelectorAll('*')]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.right > doc.clientWidth + 1 && s.position !== 'fixed' && s.visibility !== 'hidden';
    })
    .slice(0, 5)
    .map(label);
  const inlineInText = (el: Element) => el.tagName === 'A' && getComputedStyle(el).display === 'inline' && (el.parentElement?.textContent?.trim().length ?? 0) > (el.textContent?.trim().length ?? 0) + 20;
  const targets = [...document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"]')]
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ el, r }) => r.width > 0 && r.height > 0 && !inlineInText(el));
  /**
   * WCAG 2.5.8's spacing exception: an undersized target still passes when a 24px-diameter circle centred on it
   * intersects no other target, and no other undersized target's circle.
   */
  const centre = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  const circleHitsRect = (c: { x: number; y: number }, r: DOMRect) => {
    const dx = c.x - Math.max(r.left, Math.min(c.x, r.right));
    const dy = c.y - Math.max(r.top, Math.min(c.y, r.bottom));
    return dx * dx + dy * dy < 12 * 12;
  };
  const undersized = targets.filter(({ r }) => r.width < 24 || r.height < 24);
  const smallTargets = undersized
    .filter((t) => {
      const c = centre(t.r);
      const crowdedByTarget = targets.some((o) => o.el !== t.el && !o.el.contains(t.el) && !t.el.contains(o.el) && circleHitsRect(c, o.r));
      const crowdedByCircle = undersized.some((o) => {
        if (o.el === t.el) return false;
        const oc = centre(o.r);
        return Math.hypot(c.x - oc.x, c.y - oc.y) < 24;
      });
      return crowdedByTarget || crowdedByCircle;
    })
    .slice(0, 10)
    .map(({ el, r }) => `${label(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, overflowing, smallTargets };
}

/**
 * Collected in the page after load: Largest Contentful Paint and Cumulative Layout Shift from the browser's own
 * observers, and the navigation timing. Lab numbers from one load, a signal and not a field measurement.
 */
export async function webVitals(): Promise<{ lcp: number | null; cls: number; ttfb: number | null; load: number | null }> {
  // Both are reported to observers only (not through getEntriesByType); `buffered` replays what happened before.
  const observe = (type: string) =>
    new Promise<PerformanceEntry[]>((resolve) => {
      const out: PerformanceEntry[] = [];
      try {
        const po = new PerformanceObserver((list) => out.push(...list.getEntries()));
        po.observe({ type, buffered: true });
        setTimeout(() => {
          po.disconnect();
          resolve(out);
        }, 1000);
      } catch {
        resolve(out); // not supported in this engine
      }
    });
  const [paints, shifts] = await Promise.all([observe('largest-contentful-paint'), observe('layout-shift')]);
  const lcp = paints.length ? paints[paints.length - 1].startTime : null;
  const cls = (shifts as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>).filter((e) => !e.hadRecentInput).reduce((sum, e) => sum + e.value, 0);
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  return { lcp, cls, ttfb: nav ? nav.responseStart : null, load: nav ? nav.loadEventEnd : null };
}

/** WCAG 2.0–2.2 at Levels A and AA, the axe tags the accessibility check runs. */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Thresholds Google calls "good" for the two vitals measured here. */
export const VITALS = { lcpGoodMs: 2500, clsGood: 0.1 };

export function judgeVitals(v: { lcp: number | null; cls: number }): string[] {
  const problems: string[] = [];
  if (v.lcp !== null && v.lcp > VITALS.lcpGoodMs) problems.push(`Largest Contentful Paint ${Math.round(v.lcp)} ms (good is ≤ ${VITALS.lcpGoodMs})`);
  if (v.cls > VITALS.clsGood) problems.push(`Cumulative Layout Shift ${v.cls.toFixed(3)} (good is ≤ ${VITALS.clsGood})`);
  return problems;
}
