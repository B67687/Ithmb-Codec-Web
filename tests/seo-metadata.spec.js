// @ts-check
// SEO metadata regression tests: localized meta descriptions, hreflang
// alternates, and CSP presence on every page. These guard against someone
// removing the meta tags or breaking the i18n wiring (data-i18n-content).
const { test, expect } = require("@playwright/test");

const PAGES = [
  ["home", "/"],
  ["decoder", "/ithmb-decoder/"],
  ["guide", "/guide/how-to-open-ithmb-files.html"],
  ["enterprise", "/enterprise/"],
  ["404", "/404.html"],
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

    test("has en + zh hreflang alternates", async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const langs = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((els) =>
        els.map((el) => el.getAttribute("hreflang")),
      );
      expect(langs).toContain("en");
      expect(langs).toContain("zh");
    });
  });
}

test.describe("Content Security Policy", () => {
  test("every page has a CSP meta tag", async ({ page }) => {
    for (const [, path] of PAGES) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
      expect(csp, `${path} missing CSP`).toContain("default-src 'self'");
    }
  });
});
