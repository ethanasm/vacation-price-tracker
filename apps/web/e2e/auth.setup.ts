import { test as setup } from "@playwright/test";

const AUTH_FILE = "./playwright/.auth/user.json";
const API_BASE = "https://localhost:8000";

setup("authenticate", async ({ request }) => {
  // Prime CSRF cookie via a safe-method request
  await request.get(`${API_BASE}/health`);
  const state = await request.storageState();
  const csrfCookie = state.cookies.find(
    (c) => c.name === "csrf_token" && (c.domain === "localhost" || c.domain === ".localhost"),
  );
  if (!csrfCookie) {
    throw new Error("CSRF cookie not set after priming GET");
  }
  await request.post(`${API_BASE}/v1/auth/test-login`, {
    headers: { "X-CSRF-Token": csrfCookie.value },
  });
  await request.storageState({ path: AUTH_FILE });
});
