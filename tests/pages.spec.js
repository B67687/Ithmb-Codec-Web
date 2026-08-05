// @ts-check
const { test, expect } = require("@playwright/test");

test.describe("Landing page", () => {
  test("loads and shows ITHMB title", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("h2").first()).toContainText("ITHMB Decoder");
  });

  test("has links to decoder and enterprise", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('a.card[href*="ithmb-decoder"]')).toBeVisible();
    await expect(page.locator('a.card[href*="enterprise"]')).toBeVisible();
  });
});

test.describe("Enterprise page", () => {
  test("loads with correct title", async ({ page }) => {
    await page.goto("/enterprise/", {
      waitUntil: "networkidle",
    });
    await expect(page).toHaveTitle(/Enterprise/);
  });

  test("has hero section", async ({ page }) => {
    await page.goto("/enterprise/", {
      waitUntil: "networkidle",
    });
    await expect(page.locator("div.construction")).toBeVisible();
  });
});

test.describe("Guide page", () => {
  test("loads with correct title", async ({ page }) => {
    await page.goto("/guide/how-to-open-ithmb-files.html", {
      waitUntil: "networkidle",
    });
    await expect(page).toHaveTitle(/How to Open/);
  });

  test("has FAQ heading", async ({ page }) => {
    await page.goto("/guide/how-to-open-ithmb-files.html", {
      waitUntil: "networkidle",
    });
    await expect(
      page.locator("h2").filter({ hasText: "Frequently" }),
    ).toBeVisible();
  });
});
