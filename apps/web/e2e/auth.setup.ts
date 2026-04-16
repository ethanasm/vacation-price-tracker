import { test as setup } from "@playwright/test";

const AUTH_FILE = "./playwright/.auth/user.json";

setup("authenticate", async ({ request }) => {
  await request.post("http://localhost:8000/v1/auth/test-login");
  await request.storageState({ path: AUTH_FILE });
});
