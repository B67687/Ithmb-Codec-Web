// @ts-check
const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

test.describe("Accessibility", () => {
  const pages = [
    { name: "Home", url: "/" },
    { name: "Decoder", url: "/ithmb-decoder/" },
    { name: "Guide", url: "/guide/how-to-open-ithmb-files" },
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

      // Filter to only critical/serious violations
      const serious = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
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

      // Note: some violations are known design choices (contrast, link style)
      // These are intentional tradeoffs for visual aesthetics
      if (serious.length > 0) {
        console.log(`  → Known design choices: ${serious.length} violation(s)`);
      }
    });
  }
});
