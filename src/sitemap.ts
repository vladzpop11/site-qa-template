import fs from 'node:fs';
import path from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import type { SiteConfig } from './config';
import { isAllowed } from './guard';

/** Where the page list is written by the `pages` setup project and read by every check. */
export const PAGES_FILE = path.resolve(__dirname, '..', '.pages.json');

/** The `<loc>` entries of a sitemap, split into pages (`<urlset>`) and further sitemaps (`<sitemapindex>`). */
export function parseSitemap(xml: string): { pages: string[]; sitemaps: string[] } {
  const locs = (block: string) =>
    [...block.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) =>
      m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"),
    );
  if (/<sitemapindex[\s>]/i.test(xml)) return { pages: [], sitemaps: locs(xml) };
  return { pages: locs(xml), sitemaps: [] };
}

/** `n` items spread evenly across `list` (first and last included), so a cap samples the whole site, not its first section. */
export function selectEvenly<T>(list: readonly T[], n: number): T[] {
  if (list.length <= n) return [...list];
  if (n === 1) return [list[0]];
  return Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]);
}

/**
 * The pages to check: `PAGES` if given, otherwise the sitemap (indexes followed, at most 20 sitemaps), always with the
 * target page itself. Entries on hosts that are not allowed are dropped, never requested. Duplicates and fragments are
 * removed before the cap is applied.
 */
export async function collectPages(
  request: APIRequestContext,
  cfg: SiteConfig,
): Promise<{ pages: string[]; source: string; dropped: number; sitemapsRead: number }> {
  if (cfg.pages.length) {
    const allowed = cfg.pages.filter((u) => isAllowed(u, cfg)).map((u) => u.href);
    return { pages: selectEvenly([...new Set(allowed)], cfg.maxPages), source: 'PAGES', dropped: cfg.pages.length - allowed.length, sitemapsRead: 0 };
  }
  const queue = [cfg.sitemapUrl.href];
  const seen = new Set<string>();
  const found: string[] = [];
  let dropped = 0;
  while (queue.length && seen.size < 20) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    if (!isAllowed(url, cfg)) {
      dropped += 1;
      continue;
    }
    const res = await request.get(url, { failOnStatusCode: false, timeout: 30_000 });
    if (!res.ok()) continue;
    const { pages, sitemaps } = parseSitemap(await res.text());
    queue.push(...sitemaps);
    for (const p of pages) {
      if (isAllowed(p, cfg)) found.push(p);
      else dropped += 1;
    }
  }
  const unique = [...new Set(found.map((p) => p.split('#')[0]))];
  const target = cfg.targetUrl.href;
  const pages = [target, ...selectEvenly(unique.filter((p) => p !== target), cfg.maxPages - 1)];
  return { pages, source: found.length ? `sitemap (${seen.size} file(s))` : 'TARGET_URL only (no usable sitemap)', dropped, sitemapsRead: seen.size };
}

/** The page list the setup project wrote. Throws if it is missing or empty, so no check can pass having opened nothing. */
export function readPages(): string[] {
  if (!fs.existsSync(PAGES_FILE)) throw new Error(`${PAGES_FILE} is missing: run the checks through a project that depends on "pages" (npm test)`);
  const { pages } = JSON.parse(fs.readFileSync(PAGES_FILE, 'utf8')) as { pages: string[] };
  if (!pages?.length) throw new Error(`${PAGES_FILE} lists no pages`);
  return pages;
}
