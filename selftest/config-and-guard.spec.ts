import { test, expect } from '@playwright/test';
import { readConfig } from '../src/config';
import { assertAllowed, isAllowed } from '../src/guard';

/** The blanks are read as documented, and the allow-list admits exactly the hosts given. Offline. */
test.describe('selftest: config and the host allow-list', () => {
  test('an empty TARGET_URL is refused with instructions', () => {
    expect(() => readConfig({})).toThrow(/TARGET_URL is not set/);
    expect(() => readConfig({ TARGET_URL: 'not a url' })).toThrow(/not a URL/);
    expect(() => readConfig({ TARGET_URL: 'ftp://example.test/' })).toThrow(/http or https/);
  });

  test('defaults keep the suite on the target host', () => {
    const c = readConfig({ TARGET_URL: 'https://www.example.test/en/' });
    expect([...c.allowedHosts]).toEqual(['www.example.test']);
    expect(c.sitemapUrl.href).toBe('https://www.example.test/sitemap.xml');
    expect(c.maxPages).toBe(20);
    expect(c.workers).toBe(1);
    expect(c.basicAuth).toBeNull();
    expect(c.pages).toEqual([]);
  });

  test('given values are honoured, and the target host is always allowed', () => {
    const c = readConfig({
      TARGET_URL: 'https://shop.example.test/',
      ALLOWED_HOSTS: 'cdn.example.test, API.example.test',
      PAGES: '/a, https://shop.example.test/b',
      MAX_PAGES: '5',
      BASIC_AUTH_USER: 'u',
      BASIC_AUTH_PASSWORD: 'p',
    });
    expect([...c.allowedHosts].sort()).toEqual(['api.example.test', 'cdn.example.test', 'shop.example.test']);
    expect(c.pages.map((p) => p.href)).toEqual(['https://shop.example.test/a', 'https://shop.example.test/b']);
    expect(c.maxPages).toBe(5);
    expect(c.basicAuth).toEqual({ username: 'u', password: 'p' });
    expect(() => readConfig({ TARGET_URL: 'https://x.test/', MAX_PAGES: '0' })).toThrow(/MAX_PAGES/);
  });

  test('the allow-list admits exact hosts only', () => {
    const cfg = { allowedHosts: new Set(['www.example.test', 'localhost:8080']) };
    expect(isAllowed('https://www.example.test/a', cfg)).toBe(true);
    expect(isAllowed('http://localhost:8080/', cfg)).toBe(true);
    for (const url of [
      'https://example.test/',
      'https://evil.www.example.test/',
      'https://www.example.test.evil.test/',
      'https://localhost:9090/',
      'javascript:alert(1)',
      'mailto:a@www.example.test',
      'not a url',
    ]) {
      expect(isAllowed(url, cfg), url).toBe(false);
    }
    expect(() => assertAllowed('https://other.test/', cfg)).toThrow(/not in ALLOWED_HOSTS/);
  });
});
