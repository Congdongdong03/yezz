/**
 * Auth Setup for E2E Tests
 *
 * Logs in as admin via the UI and saves the authenticated state
 * so all other tests can reuse it without logging in again.
 */

import { test as setup, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  deleteMailpitMessagesFor,
  extractSetupToken,
  readMailpitMessage,
  waitForMailpitMessage,
} from "./fixtures/mailpit";

const authFile = "e2e/.auth/admin.json";

setup("admin login", async ({ page }) => {
  // Ensure the auth directory exists
  mkdirSync(dirname(authFile), { recursive: true });

  const email = process.env.E2E_ADMIN_EMAIL ?? "admin@yezz.local";
  const password = process.env.E2E_ADMIN_PASSWORD ?? "changeme";
  if (process.env.YEZYY_CLOSURE_E2E === "1") {
    const setupMail = await waitForMailpitMessage({
      recipient: email,
      subjectIncludes: "Set up your YezYY Admin password",
      timeoutMilliseconds: 15_000,
    });
    const setupToken = extractSetupToken(
      await readMailpitMessage(setupMail),
    );
    await page.goto(`/admin/setup-password?token=${setupToken}`);
    await page.getByLabel("新密码", { exact: true }).fill(password);
    await page.getByLabel("确认新密码").fill(password);
    const setupResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname ===
          "/api/backend/v1/auth/setup-password",
    );
    await page.getByRole("button", { name: "设置密码" }).click();
    const completed = await setupResponse;
    const completedBody = await completed.json();
    expect(
      completed.status(),
      `one-use Owner password setup response: ${JSON.stringify(completedBody)}`,
    ).toBe(200);
    expect(completedBody).toMatchObject({
      success: true,
      data: { ok: true },
    });
    await expect(page.getByText("密码已设置")).toBeVisible();

    const replay = await page.request.post(
      "/api/backend/v1/auth/setup-password",
      {
        data: { token: setupToken, newPassword: password },
        headers: { origin: process.env.NEXT_PUBLIC_SITE_URL! },
      },
    );
    expect(replay.status()).toBe(400);
    await deleteMailpitMessagesFor([email]);
  }

  // Navigate to admin login
  await page.goto("/admin/login");

  // Fill credentials
  await page
    .getByLabel(/邮箱|Email/)
    .fill(email);
  await page
    .getByLabel(/密码|Password/)
    .fill(password);

  // Submit
  await page.getByRole("button", { name: /登录|Login|Sign in/i }).click();

  // Wait for redirect to admin dashboard
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { name: /看板|Dashboard/i })).toBeVisible();

  // Save storage state (cookies + localStorage)
  await page.context().storageState({ path: authFile });
});
