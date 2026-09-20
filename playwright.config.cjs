const { defineConfig } = require("@playwright/test");
const path = require("node:path");
module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3010",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3010",
    url: "http://127.0.0.1:3010/dashboard",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      CLUB_E2E: "1",
      DATABASE_PATH: path.resolve(".data/e2e.db"),
      GEMINI_API_KEY: "",
      OPENROUTER_API_KEY: "",
    },
  },
});
