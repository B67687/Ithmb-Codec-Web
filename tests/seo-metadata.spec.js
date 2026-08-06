// @ts-check
// SEO metadata regression tests: localized meta descriptions, hreflang
// alternates, and CSP presence on every page. These guard against someone
// removing the meta tags or breaking the i18n wiring (data-i18n-content).
//
// Phase 3: the hreflang alternates now point at the real server-rendered
// /zh/ page tree (en ↔ zh real URLs plus x-default → English), replacing the
// old ?lang= client-side swap URLs. The 404 page is noindexed and has no zh
// counterpart, so it intentionally carries no hreflang links.
const { test, expect } = require("@playwright/test");

const PAGES = [
  ["home", "/"],
  ["decoder", "/ithmb-decoder/"],
  ["guide", "/guide/how-to-open-ithmb-files.html"],
  ["enterprise", "/enterprise/"],
  ["404", "/404.html"],
];

// Content pages with their canonical English and Chinese URLs (the guide's
// canonical is the extensionless path, matching sitemap.xml).
const CONTENT_PAGES = [
  ["home", "/", "https://ithmb-codec.dev/", "https://ithmb-codec.dev/zh/"],
  [
    "decoder",
    "/ithmb-decoder/",
    "https://ithmb-codec.dev/ithmb-decoder/",
    "https://ithmb-codec.dev/zh/ithmb-decoder/",
  ],
  [
    "guide",
    "/guide/how-to-open-ithmb-files.html",
    "https://ithmb-codec.dev/guide/how-to-open-ithmb-files",
    "https://ithmb-codec.dev/zh/guide/how-to-open-ithmb-files",
  ],
  [
    "enterprise",
    "/enterprise/",
    "https://ithmb-codec.dev/enterprise/",
    "https://ithmb-codec.dev/zh/enterprise/",
  ],
];

const ZH_PAGES = [
  ["zh home", "/zh/", "https://ithmb-codec.dev/", "https://ithmb-codec.dev/zh/"],
  [
    "zh decoder",
    "/zh/ithmb-decoder/",
    "https://ithmb-codec.dev/ithmb-decoder/",
    "https://ithmb-codec.dev/zh/ithmb-decoder/",
  ],
  [
    "zh guide",
    "/zh/guide/how-to-open-ithmb-files.html",
    "https://ithmb-codec.dev/guide/how-to-open-ithmb-files",
    "https://ithmb-codec.dev/zh/guide/how-to-open-ithmb-files",
  ],
  [
    "zh enterprise",
    "/zh/enterprise/",
    "https://ithmb-codec.dev/enterprise/",
    "https://ithmb-codec.dev/zh/enterprise/",
  ],
];

for (const [name, path] of PAGES) {
  test.describe(`${name} SEO metadata`, () => {
    test("has a meta description", async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const content = await page.locator('meta[name="description"]').getAttribute("content");
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(30);
    });

test("description is localized (flips with language)", async ({ page }) => {
await page.goto(path, { waitUntil: "domcontentloaded" });
const en = await page.locator('meta[name="description"]').getAttribute("content");
      // Force zh via localStorage + reload (avoids depending on toggle state).
      // i18n.js is injected as a deferred module on some pages (nav.js), so
      // wait for the CJK translation to actually land instead of reading too
      // early (was flaky under parallel workers).
await page.evaluate(() => localStorage.setItem("ithmbLang", "zh"));
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() =>
        /[\u4e00-\u9fff]/.test(
          document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
        ),
      );
const zh = await page.locator('meta[name="description"]').getAttribute("content");
await page.evaluate(() => localStorage.removeItem("ithmbLang"));
expect(en).toBeTruthy();
expect(zh).toBeTruthy();
expect(en).not.toBe(zh);
      // Chinese description should contain CJK characters
      expect(/[\u4e00-\u9fff]/.test(zh)).toBe(true);
    });
  });
}

test.describe("hreflang + canonical (real /zh/ URLs)", () => {
  for (const [name, path, enUrl, zhUrl] of CONTENT_PAGES) {
    test(`${name}: en ↔ zh alternates with x-default to the English URL`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(canonical).toBe(enUrl);
      const links = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((els) =>
        els.map((el) => ({ lang: el.getAttribute("hreflang"), href: el.getAttribute("href") })),
      );
      expect(links).toContainEqual({ lang: "en", href: enUrl });
      expect(links).toContainEqual({ lang: "zh", href: zhUrl });
      expect(links).toContainEqual({ lang: "x-default", href: enUrl });
      // The old ?lang= duplicate-URL scheme must not remain on any page.
      expect(await page.locator('link[href*="?lang="]').count()).toBe(0);
    });
  }
});

test.describe("Chinese /zh/ pages (server-rendered)", () => {
  for (const [name, path, enUrl, zhUrl] of ZH_PAGES) {
    test(`${name}: fully Chinese HTML with real en ↔ zh hreflang`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const htmlLang = await page.locator("html").getAttribute("lang");
      expect(htmlLang.toLowerCase().startsWith("zh")).toBe(true);
      const title = await page.title();
      expect(/[\u4e00-\u9fff]/.test(title)).toBe(true);
      const desc = await page.locator('meta[name="description"]').getAttribute("content");
      expect(/[\u4e00-\u9fff]/.test(desc)).toBe(true);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(canonical).toBe(zhUrl);
      const links = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((els) =>
        els.map((el) => ({ lang: el.getAttribute("hreflang"), href: el.getAttribute("href") })),
      );
      expect(links).toContainEqual({ lang: "en", href: enUrl });
      expect(links).toContainEqual({ lang: "zh", href: zhUrl });
      expect(links).toContainEqual({ lang: "x-default", href: enUrl });
      expect(await page.locator('link[href*="?lang="]').count()).toBe(0);
      // The visible body content is Chinese — served statically, not swapped
      // in by JS (i18n.js forces zh on /zh/ pages, so this holds with or
      // without the module loaded).
      const bodyText = await page.locator("body").innerText();
      expect(/[\u4e00-\u9fff]/.test(bodyText)).toBe(true);
    });
  }
});

test.describe("Content Security Policy", () => {
  test("every page has a CSP meta tag", async ({ page }) => {
    for (const [, path] of PAGES.concat(ZH_PAGES)) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
      expect(csp, `${path} missing CSP`).toContain("default-src 'self'");
    }
  });
});
