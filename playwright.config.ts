import { defineConfig, devices } from '@playwright/test';
import { readConfig, type SiteConfig } from './src/config';

/**
 * Projects:
 * - `selftest`: the checks proven on planted examples, offline. Run it after changing anything in `src/`.
 * - `pages`: reads the page list from the site; every check project depends on it.
 * - `desktop` (Chromium 1280px), `phone` (Chromium, Pixel 7), `iphone` (WebKit, iPhone 15): the checks.
 *
 * The site comes from `.env` (see `.env.example`). Without `TARGET_URL` only `selftest` can run.
 */
let site: SiteConfig | null = null;
try {
  site = readConfig();
} catch {
  site = null;
}

const httpCredentials = site?.basicAuth ? { ...site.basicAuth, origin: site.targetUrl.origin } : undefined;
const checks = { testDir: './tests', dependencies: ['pages'] };

export default defineConfig({
  timeout: 120_000,
  workers: site?.workers ?? 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  // Baselines are approvals: a missing one fails with instructions instead of being written silently (npm run baseline).
  updateSnapshots: 'none',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  use: {
    baseURL: site?.targetUrl.origin,
    httpCredentials,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'selftest', testDir: './selftest' },
    { name: 'pages', testDir: './setup', testMatch: /pages\.setup\.ts/ },
    { name: 'desktop', ...checks, use: { ...devices['Desktop Chrome'], httpCredentials } },
    { name: 'phone', ...checks, use: { ...devices['Pixel 7'], httpCredentials } },
    { name: 'iphone', ...checks, use: { ...devices['iPhone 15'], httpCredentials } },
  ],
});
