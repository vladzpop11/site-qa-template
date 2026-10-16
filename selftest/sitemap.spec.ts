import { test, expect, type APIRequestContext } from '@playwright/test';
import { readConfig } from '../src/config';
import { collectPages, parseSitemap, selectEvenly } from '../src/sitemap';

/** The page list comes from the sitemap as documented, and nothing outside the allow-list is ever requested. Offline. */
const URLSET = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.example.test/</loc></url>
  <url><loc> https://www.example.test/a?x=1&amp;y=2 </loc></url>
  <url><loc><![CDATA[https://www.example.test/b]]></loc></url>
  <url><loc>https://other.test/c</loc></url>
</urlset>`;
const INDEX = `<sitemapindex><sitemap><loc>https://www.example.test/s1.xml</loc></sitemap><sitemap><loc>https://other.test/s2.xml</loc></sitemap></sitemapindex>`;

function fakeRequest(files: Record<string, string>) {
  const asked: string[] = [];
  const request = {
    get: async (url: string) => {
      asked.push(url);
      const body = files[url];
      return { ok: () => body !== undefined, text: async () => body ?? '' };
    },
  } as unknown as APIRequestContext;
  return { request, asked };
}

test.describe('selftest: the page list', () => {
  test('a urlset and a sitemap index are read, entities and CDATA included', () => {
    expect(parseSitemap(URLSET)).toEqual({
      pages: ['https://www.example.test/', 'https://www.example.test/a?x=1&y=2', 'https://www.example.test/b', 'https://other.test/c'],
      sitemaps: [],
    });
    expect(parseSitemap(INDEX)).toEqual({ pages: [], sitemaps: ['https://www.example.test/s1.xml', 'https://other.test/s2.xml'] });
    expect(parseSitemap('<html>not a sitemap</html>')).toEqual({ pages: [], sitemaps: [] });
  });

  test('a cap samples the whole list evenly, first and last included', () => {
    const list = Array.from({ length: 100 }, (_, i) => i);
    expect(selectEvenly(list, 5)).toEqual([0, 25, 50, 74, 99]);
    expect(selectEvenly(list, 1)).toEqual([0]);
    expect(selectEvenly([1, 2], 5)).toEqual([1, 2]);
  });

  test('an index is followed, other hosts are dropped unrequested, and the target page comes first', async () => {
    const cfg = readConfig({ TARGET_URL: 'https://www.example.test/', SITEMAP_URL: '/index.xml', MAX_PAGES: '10' });
    const { request, asked } = fakeRequest({ 'https://www.example.test/index.xml': INDEX, 'https://www.example.test/s1.xml': URLSET });
    const r = await collectPages(request, cfg);
    expect(r.pages[0]).toBe('https://www.example.test/');
    expect(r.pages).toEqual(['https://www.example.test/', 'https://www.example.test/a?x=1&y=2', 'https://www.example.test/b']);
    expect(asked, 'only allowed hosts were requested').toEqual(['https://www.example.test/index.xml', 'https://www.example.test/s1.xml']);
    expect(r.dropped, 'the other host’s sitemap and page were dropped').toBe(2);
  });

  test('PAGES replaces the sitemap, still filtered by the allow-list', async () => {
    const cfg = readConfig({ TARGET_URL: 'https://www.example.test/', PAGES: '/x, https://other.test/y' });
    const { request, asked } = fakeRequest({});
    const r = await collectPages(request, cfg);
    expect(r.pages).toEqual(['https://www.example.test/x']);
    expect(r.dropped).toBe(1);
    expect(asked).toEqual([]);
  });

  test('with no usable sitemap the target page alone is checked', async () => {
    const cfg = readConfig({ TARGET_URL: 'https://www.example.test/home' });
    const { request } = fakeRequest({});
    const r = await collectPages(request, cfg);
    expect(r.pages).toEqual(['https://www.example.test/home']);
    expect(r.source).toMatch(/no usable sitemap/);
  });
});
