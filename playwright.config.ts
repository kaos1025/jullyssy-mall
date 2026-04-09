import { defineConfig, devices } from "@playwright/test"
import path from "path"

const authDir = path.join(__dirname, "e2e", ".auth")

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "html",
  timeout: 60_000,

  use: {
    baseURL: "https://jullyssy.shop",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: /global-setup\.ts/,
      testDir: "./e2e",
    },
    {
      name: "auth-tests",
      use: {
        ...devices["Desktop Chrome"],
        // storageState 없음 — 비로그인 상태
      },
      dependencies: ["setup"],
      testMatch: /auth\.spec|guest-/,
    },
    {
      name: "user-tests",
      use: {
        ...devices["Desktop Chrome"],
      },
      dependencies: ["setup"],
      testIgnore: /admin-|auth\.spec/,
    },
    {
      name: "admin-tests",
      use: {
        ...devices["Desktop Chrome"],
      },
      dependencies: ["setup"],
      testMatch: /admin-/,
    },
  ],
})
