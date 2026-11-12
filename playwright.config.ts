import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const E2E_DB = "postgresql://postgres:postgres@localhost:5432/jnd_e2e";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: { baseURL: "http://localhost:3100", trace: "off" },
  globalSetup: "./tests/e2e/global-setup.ts",
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        // Navegador preinstalado del entorno (si existe); en otro equipo, Playwright usa el suyo
        launchOptions: existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {},
      },
    },
  ],
  webServer: [
    {
      command: "npx next start -p 3100",
      url: "http://localhost:3100/api/health",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: E2E_DB,
        APP_URL: "http://localhost:3100",
        STRIPE_WEBHOOK_SECRET: "whsec_e2e",
        STORAGE_LOCAL_DIR: "./.e2e-storage",
        EMAIL_DRIVER: "console",
        CSP_EXTRA_MEDIA_SOURCES: "http://localhost:4100",
      },
    },
    { command: "node tests/e2e/fixtures/server.mjs", port: 4100, reuseExistingServer: false },
  ],
});
