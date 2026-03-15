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
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "pixel-5",
      use: { ...pixel5 }
    },
    {
      name: "iphone-13",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium"
      }
    },
    {
      name: "pixel-5-short",
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
