/**
 * Auth Setup for E2E Tests
 *
 * Logs in as admin via the UI and saves the authenticated state
 * so all other tests can reuse it without logging in again.
 */

import { test as setup, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const authFile = "e2e/.auth/admin.json";

setup("admin login", async ({ page }) => {
  // Ensure the auth directory exists
  mkdirSync(dirname(authFile), { recursive: true });

  // Navigate to admin login
  await page.goto("/admin/login");

  // Fill credentials
  await page
    .getByLabel(/邮箱|Email/)
    .fill(process.env.E2E_ADMIN_EMAIL ?? "admin@yezz.local");
  await page
    .getByLabel(/密码|Password/)
    .fill(process.env.E2E_ADMIN_PASSWORD ?? "changeme");

  // Submit
  await page.getByRole("button", { name: /登录|Login|Sign in/i }).click();

  // Wait for redirect to admin dashboard
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { name: /看板|Dashboard/i })).toBeVisible();

  // Save storage state (cookies + localStorage)
  await page.context().storageState({ path: authFile });
});
