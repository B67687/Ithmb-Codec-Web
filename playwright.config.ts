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
  // Own the local server lifecycle: Playwright starts it, polls the URL until
  // ready (replacing the fixed `sleep 3` + shell trap that was racy on slow
  // runners), and kills it on exit. Reuses an already-running server when not
  // in CI (preserves `npm run serve` local flow). See ADR-0007.
  webServer: {
    command: "npx http-server -p 8899 -c-1 -s",
    url: "http://localhost:8899",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
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
