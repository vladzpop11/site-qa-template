# site-qa-template

Passive quality checks for **any website you are allowed to test**. Fill in the blanks in `.env`, run one command,
and every check walks the pages listed in the site's own sitemap, on a desktop and on a phone.

Built with Playwright and axe. Nothing in it belongs to a particular site. The site is entirely in `.env`.

## Quick start

```bash
npm ci                         # once (Node 20+); then: npx playwright install chromium webkit
cp .env.example .env           # fill in TARGET_URL at least
npm run selftest               # the checks proven on planted examples, offline: run this first
npm test                       # desktop + phone (Chromium)
npm run test:iphone            # optional: WebKit on an iPhone 15 viewport
npm run report                 # the HTML report of the last run
```

## The blanks (`.env`)

| Setting | Meaning | Default |
| --- | --- | --- |
| `TARGET_URL` | The page the checks start from. **Required.** | none |
| `ALLOWED_HOSTS` | Hosts the suite may navigate to or request, comma-separated | `TARGET_URL`'s host only |
| `SITEMAP_URL` | Where the page list comes from; sitemap indexes are followed | `<origin>/sitemap.xml` |
| `PAGES` | Your own page list (paths or URLs); replaces the sitemap | none |
| `MAX_PAGES` | How many pages to check, spread evenly across the site | 20 |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` | For a site behind HTTP basic auth; sent to the target origin only | none |
| `WORKERS` | Parallel browsers | 1 |
| `MAX_LINKS` | How many internal links the link check requests | 150 |

## What it checks

| Check | File | Projects | What fails it |
| --- | --- | --- | --- |
| Accessibility | `tests/accessibility.spec.ts` | all | any axe violation at WCAG 2.0–2.2 A/AA |
| Reflow | `tests/layout.spec.ts` | desktop | horizontal scrolling at 320 CSS px (WCAG 1.4.10) |
| Phone layout | `tests/layout.spec.ts` | phone, iphone | overflow at the phone's width; targets under 24×24px (WCAG 2.5.8) |
| Performance | `tests/performance.spec.ts` | all | LCP over 2.5s or CLS over 0.1 (one lab load per page) |
| Errors | `tests/console.spec.ts` | all | uncaught exceptions, `console.error`, a 4xx/5xx for a script, style, image, font or API call |
| Security headers | `tests/headers.spec.ts` | desktop | no HSTS (https), CSP, nosniff, framing protection or Referrer-Policy; a disclosing `X-Powered-By`; cookies without Secure/SameSite, session-like cookies without HttpOnly |
| Links | `tests/links.spec.ts` | desktop | an internal link answering 4xx/5xx; anything loaded over http on an https page |
| Search basics | `tests/seo.spec.ts` | desktop | no title (or over 65 characters), description, canonical, `lang`, viewport; not exactly one h1; an unexpected noindex; no robots.txt or sitemap |
| Visual | `tests/visual.spec.ts` | all | a page changed by more than 1% of its pixels since its approved baseline |

Each check runs on every listed page and fails once, at the end, with every problem it found, each prefixed with the
page's path. A page that cannot be opened is reported as a problem, and the rest are still checked. A check that could
open no page at all fails rather than passing on nothing.

## Safety: what it will and will not do

- **It contacts only the hosts in `ALLOWED_HOSTS`.** Every page it opens and every link it requests is checked first.
  Sitemap entries and links on other hosts are counted, never requested. A redirect or script that tries to navigate
  away is stopped and reported. A page's own subresources (its CDN, fonts, analytics) load as they would for a
  visitor, because blocking them would change what is measured.
- **It is passive.** It sends only the requests a visitor's browser sends: page loads, plain GETs for headers and
  links. There are no injection payloads, no login attempts, no form submissions and no load testing. Those need the
  site owner's permission and a different tool.
- **It is polite by default:** one browser, at most 20 pages, one retry after a 503 or 429.
- **Run it only on a site you own or have written permission to test.** Passive checks are still traffic you are
  responsible for.
- `.env` holds credentials and is ignored by git. Never commit it.

## What a result means and does not mean

- **axe finds roughly a third to a half of accessibility problems.** A clean run is not WCAG conformance; keyboard use
  and a screen reader still need a person.
- **Performance numbers are one cold lab load** on your machine and network: a signal for comparing runs, not what
  visitors measure. LCP is not available in WebKit, and is then not judged.
- **The header check reports missing protections. It does not grade their values,** for example how strict a CSP is.
- **Visual baselines are approvals.** The first run fails because there are none. Look at the pages, then record them
  with `npm run baseline`. Mask dynamic content (dates, carousels) in your copy of `tests/visual.spec.ts` if it makes
  runs differ.

## The selftests

`npm run selftest` runs offline and proves each part on planted examples:
- the config and the allow-list, including look-alike hosts;
- the sitemap reader, including that an entry on another host is never requested;
- every rule;
- each in-page check, on pages built in the test, catching a planted fault and passing the clean version: a missing
  alt, a 1000px block at 320px, a 16px button, a layout shift.

A broken measurement and a clean site both look green, so run the selftests after changing anything in `src/`.

## Layout

```
.env.example        the blanks
playwright.config.ts projects: selftest, pages, desktop, phone, iphone
setup/              reads the page list from the site (.pages.json)
src/config.ts       reads .env
src/guard.ts        the host allow-list
src/sitemap.ts      sitemap reading and page sampling
src/judges.ts       every rule, as plain functions
src/fixtures.ts     visit(), checkEveryPage()
tests/              the checks
selftest/           the checks proven offline
```
