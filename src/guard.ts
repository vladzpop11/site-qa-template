import type { BrowserContext, Route } from '@playwright/test';
import type { SiteConfig } from './config';

/**
 * **The suite contacts only the hosts you list.** Every page it opens and every link it requests goes through
 * `assertAllowed`. A page's own subresources (its fonts, scripts, images) load as they would for a visitor, because
 * blocking them would change what is measured. A top-level navigation that leaves the allowed hosts (a redirect, a
 * script changing location) is stopped by `guardNavigations` and recorded.
 */
export function isAllowed(url: string | URL, cfg: Pick<SiteConfig, 'allowedHosts'>): boolean {
  try {
    const u = new URL(String(url));
    return /^https?:$/.test(u.protocol) && cfg.allowedHosts.has(u.host.toLowerCase());
  } catch {
    return false;
  }
}

export function assertAllowed(url: string | URL, cfg: Pick<SiteConfig, 'allowedHosts'>, what = 'request'): void {
  if (!isAllowed(url, cfg)) {
    throw new Error(`refusing ${what} to ${String(url)}: its host is not in ALLOWED_HOSTS (${[...cfg.allowedHosts].join(', ')})`);
  }
}

/** Abort any top-level navigation to a host that is not allowed; returns the list of what was stopped. */
export async function guardNavigations(context: BrowserContext, cfg: Pick<SiteConfig, 'allowedHosts'>): Promise<string[]> {
  const stopped: string[] = [];
  await context.route(
    (url) => !isAllowed(url, cfg),
    async (route: Route) => {
      const req = route.request();
      if (req.isNavigationRequest() && req.frame().parentFrame() === null) {
        stopped.push(req.url());
        return route.abort('blockedbyclient');
      }
      return route.continue();
    },
  );
  return stopped;
}
