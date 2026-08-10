import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    // Local-first default: tests must hit a real server (the committed
    // static build served by npm run serve). CI overrides via BASE_URL.
    // Never default to the production site - that silently tests prod.
    baseURL: process.env.BASE_URL || "http://localhost:8899",
    trace: "on-first-retry",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: {
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
      },
    },
    {
      name: "firefox",
      use: {
        browserName: "firefox",
        launchOptions: {
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
      },
    },
    {
      name: "webkit",
      use: {
        browserName: "webkit",
      },
    },
  ],
});
