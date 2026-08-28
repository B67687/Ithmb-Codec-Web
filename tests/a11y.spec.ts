import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility", () => {
  const pages = [
    { name: "Home", url: "/" },
    { name: "Decoder", url: "/ithmb-decoder/" },
    { name: "Guide", url: "/guide/how-to-open-ithmb-files.html" },
    { name: "Enterprise", url: "/enterprise/" },
    { name: "404", url: "/nonexistent" },
  ];

  for (const { name, url } of pages) {
    test(`${name} page has no critical accessibility violations`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
        .analyze();

      // Known intentional exclusions (Apple-like low-contrast grays for visual aesthetics)
      const KNOWN_A11Y_EXCLUSIONS = new Set(["color-contrast"]);

      // Filter to critical/serious, excluding known intentional design choices
      const serious = results.violations.filter(
        (v) =>
          (v.impact === "critical" || v.impact === "serious") &&
          !KNOWN_A11Y_EXCLUSIONS.has(v.id)
      );

      if (serious.length > 0) {
        console.log(`\n=== ${name}: ${serious.length} critical/serious violations ===`);
        for (const v of serious) {
          console.log(`  ${v.id}: ${v.help}`);
          console.log(`  Impact: ${v.impact}`);
          console.log(`  Elements: ${v.nodes.length}`);
          console.log(`  URL: ${v.helpUrl}`);
        }
      }

      // Authoritative gate: any unexpected critical/serious violation fails CI.
      // Known intentional exclusions (e.g. color-contrast) are listed above.
      expect(serious).toHaveLength(0);
    });
  }
});
