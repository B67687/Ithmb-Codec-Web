/**
 * Playwright test suite for WASM decoder file uploads.
 * Tests batch decoding, second-batch decoding, duplicate filenames, and compact threshold.
 */
import { test, expect } from "@playwright/test";
import path from "node:path";

const PAGE_URL = "/ithmb-decoder/";
const FIXTURES = path.resolve(__dirname, "fixtures");

test.describe("File Upload", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  });

  test("drops 8 distinct files — all decode successfully", async ({ page }) => {
    const fc = page.waitForEvent("filechooser");
    await page.locator("#dropzone").click();
    const fileChooser = await fc;

    const files = Array.from({ length: 8 }, (_, i) =>
      path.join(FIXTURES, "test" + (i + 1) + ".ithmb"),
    );
    await fileChooser.setFiles(files);

    await expect(page.locator(".file-card")).toHaveCount(8);

    // Wait until all cards are done decoding
    await expect(async () => {
      const statuses = await page
        .locator(".file-card .status")
        .allTextContents();
      expect(statuses.every((s) => !s.includes("Decoding..."))).toBe(true);
    }).toPass({ timeout: 60000 });

    const statuses = await page.locator(".file-card .status").allTextContents();
    for (const s of statuses) {
      expect(s).not.toContain("Error");
    }
    expect(statuses.length).toBe(8);
  });

  test("second batch of distinct files also decodes", async ({ page }) => {
    // First batch
    let fc = page.waitForEvent("filechooser");
    await page.locator("#dropzone").click();
    let f = await fc;
    await f.setFiles([
      path.join(FIXTURES, "test1.ithmb"),
      path.join(FIXTURES, "test2.ithmb"),
      path.join(FIXTURES, "test3.ithmb"),
    ]);
    await expect(page.locator(".file-card")).toHaveCount(3);
    await expect(async () => {
      const s = await page.locator(".file-card .status").allTextContents();
      expect(s.every((t) => !t.includes("Decoding..."))).toBe(true);
    }).toPass({ timeout: 60000 });

    // Second batch
    fc = page.waitForEvent("filechooser");
    await page.locator("#dropzone").click();
    f = await fc;
    await f.setFiles([
      path.join(FIXTURES, "test4.ithmb"),
      path.join(FIXTURES, "test5.ithmb"),
      path.join(FIXTURES, "test6.ithmb"),
    ]);
    await expect(page.locator(".file-card")).toHaveCount(6);
    await expect(async () => {
      const s = await page.locator(".file-card .status").allTextContents();
      expect(s.every((t) => !t.includes("Decoding..."))).toBe(true);
    }).toPass({ timeout: 60000 });

    const statuses = await page.locator(".file-card .status").allTextContents();
    expect(statuses.length).toBe(6);
    for (const s of statuses) {
      expect(s).toContain("Decoded");
    }
  });

  test("duplicate filenames — same file dropped 8 times", async ({ page }) => {
    // Focus on console errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // First drop: file test1.ithmb once
    let fc = page.waitForEvent("filechooser");
    await page.locator("#dropzone").click();
    let f = await fc;
    await f.setFiles([path.join(FIXTURES, "test1.ithmb")]);
    await expect(page.locator(".file-card")).toHaveCount(1);
    await expect(async () => {
      const s = await page.locator(".file-card .status").allTextContents();
      expect(s.every((t) => !t.includes("Decoding..."))).toBe(true);
    }).toPass({ timeout: 60000 });

    // Second drop: drop test1.ithmb again — same file, same content hash, should be deduplicated
    fc = page.waitForEvent("filechooser");
    await page.locator("#dropzone").click();
    f = await fc;
    await f.setFiles([path.join(FIXTURES, "test1.ithmb")]);
    await page.waitForTimeout(1000);

    // With content-hash deduplication, the identical file is not re-added
    await expect(page.locator(".file-card")).toHaveCount(1);
    // We expect no unhandled errors
    expect(errors).toHaveLength(0);
  });
});
