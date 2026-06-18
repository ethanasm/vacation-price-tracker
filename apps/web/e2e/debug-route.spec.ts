import { mkdirSync } from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";

/**
 * Reusable, env-driven debugging spec.
 *
 * Drive it with the DEBUG_ROUTE env var to point Playwright at any route while
 * debugging the web UI. It navigates there (reusing the stored auth state from
 * the light/dark projects), waits for the network to settle, captures a
 * full-page screenshot, and dumps console + pageerror output to the terminal
 * and to a sidecar log file.
 *
 * This is intentionally NOT part of the Jest run (Jest only matches
 * *.test.{ts,tsx}; Playwright specs are *.spec.ts) and e2e is not run in CI.
 *
 * Usage:
 *   DEBUG_ROUTE=/trips/<id> pnpm --filter vacation-price-tracker-web \
 *     exec playwright test e2e/debug-route.spec.ts --project=light
 *
 * Run --project=dark for the dark color scheme. Run auth.setup.ts first if no
 * stored auth state exists (the light/dark projects depend on the setup
 * project, so a normal invocation handles this automatically).
 *
 * Artifacts land in apps/web/e2e/screenshots/ (git-ignored). We deliberately
 * avoid playwright-report/ because the HTML reporter wipes that directory at
 * the end of every run, which would delete the screenshots.
 */

const ROUTE = process.env.DEBUG_ROUTE || "/";
const OUTPUT_DIR = path.join("e2e", "screenshots");

// Turn a route into a filesystem-safe slug for artifact names, e.g.
// "/trips/abc-123" -> "trips-abc-123", "/" -> "root".
function slugifyRoute(route: string): string {
  const slug = route.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return slug || "root";
}

test(`debug route ${ROUTE}`, async ({ page }, testInfo) => {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const slug = slugifyRoute(ROUTE);
  const projectName = testInfo.project.name;
  const baseName = `${slug}-${projectName}`;

  const consoleLines: string[] = [];
  const errorLines: string[] = [];

  page.on("console", (msg) => {
    const line = `[console:${msg.type()}] ${msg.text()}`;
    consoleLines.push(line);
    console.log(line);
  });
  page.on("pageerror", (err) => {
    const line = `[pageerror] ${err.message}`;
    errorLines.push(line);
    console.log(line);
  });

  const response = await page.goto(ROUTE, { waitUntil: "networkidle" });
  console.log(`[debug-route] navigated to ${ROUTE} -> HTTP ${response?.status() ?? "n/a"}`);

  const screenshotPath = path.join(OUTPUT_DIR, `${baseName}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`[debug-route] screenshot saved to apps/web/${screenshotPath.split(path.sep).join("/")}`);

  // Persist console + pageerror output next to the screenshot for later review.
  const logBody = [
    `route: ${ROUTE}`,
    `project: ${projectName}`,
    `status: ${response?.status() ?? "n/a"}`,
    "",
    "--- console ---",
    ...(consoleLines.length ? consoleLines : ["(none)"]),
    "",
    "--- pageerror ---",
    ...(errorLines.length ? errorLines : ["(none)"]),
    "",
  ].join("\n");

  await testInfo.attach(`${baseName}-console.log`, {
    body: logBody,
    contentType: "text/plain",
  });

  if (errorLines.length > 0) {
    console.log(`[debug-route] captured ${errorLines.length} page error(s) for ${ROUTE}`);
  }
});
