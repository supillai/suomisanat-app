import { defineConfig, devices } from "@playwright/test";

const pixel5 = devices["Pixel 5"];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run preview:e2e",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      testIgnore: ["**/*.mobile.spec.ts"],
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "pixel-5",
      testIgnore: ["**/*.desktop.spec.ts"],
      use: { ...pixel5 }
    },
    {
      name: "iphone-13",
      testIgnore: ["**/*.desktop.spec.ts"],
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium"
      }
    },
    {
      name: "pixel-5-short",
      testIgnore: ["**/*.desktop.spec.ts"],
      use: {
        ...pixel5,
        viewport: {
          ...pixel5.viewport,
          height: 640
        }
      }
    }
  ]
});
