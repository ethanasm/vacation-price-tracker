import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 1,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "https://localhost:3000",
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "light",
      use: { colorScheme: "light", storageState: "./playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
    {
      name: "dark",
      use: { colorScheme: "dark", storageState: "./playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "echo 'Assumes Docker stack is running'",
    url: "https://localhost:3000",
    reuseExistingServer: true,
    ignoreHTTPSErrors: true,
  },
});
