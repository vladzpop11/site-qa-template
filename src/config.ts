import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

/**
 * **Everything that names the site under test, in one place.** Filled from `.env` (see `.env.example`). Only
 * `TARGET_URL` is required; every other value has a default that keeps the suite on the target's own host.
 */
export type SiteConfig = {
  targetUrl: URL;
  /** Hosts the suite may navigate to or request. Nothing else is ever requested by the suite itself. */
  allowedHosts: Set<string>;
  sitemapUrl: URL;
  /** Explicit pages from `PAGES`, which replace the sitemap when given. */
  pages: URL[];
  maxPages: number;
  basicAuth: { username: string; password: string } | null;
  workers: number;
};

const blank = (v: string | undefined) => !v || !v.trim();

export function readConfig(env: NodeJS.ProcessEnv = process.env): SiteConfig {
  if (blank(env.TARGET_URL)) {
    throw new Error('TARGET_URL is not set. Copy .env.example to .env and fill in the site you are allowed to test.');
  }
  let targetUrl: URL;
  try {
    targetUrl = new URL(env.TARGET_URL!.trim());
  } catch {
    throw new Error(`TARGET_URL is not a URL: "${env.TARGET_URL}"`);
  }
  if (!/^https?:$/.test(targetUrl.protocol)) throw new Error(`TARGET_URL must be http or https, not ${targetUrl.protocol}`);

  const allowedHosts = new Set(
    (blank(env.ALLOWED_HOSTS) ? targetUrl.host : env.ALLOWED_HOSTS!)
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
  allowedHosts.add(targetUrl.host.toLowerCase());

  const sitemapUrl = new URL(blank(env.SITEMAP_URL) ? '/sitemap.xml' : env.SITEMAP_URL!.trim(), targetUrl);
  const pages = blank(env.PAGES) ? [] : env.PAGES!.split(',').map((p) => new URL(p.trim(), targetUrl));
  const maxPages = blank(env.MAX_PAGES) ? 20 : Number(env.MAX_PAGES);
  if (!Number.isInteger(maxPages) || maxPages < 1) throw new Error(`MAX_PAGES must be a whole number above 0, not "${env.MAX_PAGES}"`);
  const workers = blank(env.WORKERS) ? 1 : Number(env.WORKERS);
  if (!Number.isInteger(workers) || workers < 1) throw new Error(`WORKERS must be a whole number above 0, not "${env.WORKERS}"`);

  const basicAuth =
    !blank(env.BASIC_AUTH_USER) && !blank(env.BASIC_AUTH_PASSWORD)
      ? { username: env.BASIC_AUTH_USER!, password: env.BASIC_AUTH_PASSWORD! }
      : null;

  return { targetUrl, allowedHosts, sitemapUrl, pages, maxPages, basicAuth, workers };
}

/** The config for a test run; read once. Throws with instructions when `.env` is not filled in. */
let cached: SiteConfig | null = null;
export function config(): SiteConfig {
  cached ??= readConfig();
  return cached;
}
