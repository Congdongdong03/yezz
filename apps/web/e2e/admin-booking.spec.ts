/**
 * E2E Test: Admin Booking Management Flow
 *
 * Core admin journey:
 *   Login → View bookings list → See new booking → Update status
 *   → Verify status change → Illegal transitions blocked
 */

import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import {
  getAdminCookieFromState,
  getAdminBookings,
  updateBookingStatus,
} from "./fixtures/api-client";

test.describe("管理员预约管理", () => {
  let testBookingId: string | null = null;
  let adminCookie: string | null = null;
  let testName: string;

  test.beforeAll(async () => {
    // Reuse admin cookie from auth setup
    adminCookie = getAdminCookieFromState();
    if (!adminCookie) {
      throw new Error("Admin auth state not found. Run auth.setup.ts first.");
    }

    testName = `E2E Admin Test ${Date.now()}`;

    // Clear Redis rate limits to avoid booking creation being blocked
    try {
      execSync("redis-cli KEYS 'ratelimit:bookings:*' | xargs -r redis-cli DEL", { stdio: "ignore" });
    } catch {
      // ignore if redis-cli is not available
    }

    // Create a test booking via public API
    const res = await fetch("http://localhost:4000/api/v1/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: testName,
        phone: "13800138003",
        email: "e2e-admin@example.com",
        message: "E2E test booking for admin flow",
        locale: "zh",
      }),
    });

    const json = (await res.json()) as { success: boolean; data?: { id: string } };
    if (json.success && json.data?.id) {
      testBookingId = json.data.id;
    } else {
      throw new Error(`Failed to create test booking: ${JSON.stringify(json)}`);
    }
  });

  test.afterAll(async () => {
    // Clean up: cancel the test booking
    if (testBookingId && adminCookie) {
      try {
        await updateBookingStatus(adminCookie, testBookingId, "cancelled");
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("管理员可以查看并更新预约状态", async ({ page }) => {
    // 1. Navigate to admin bookings (already logged in via storage state)
    await page.goto("/admin/bookings");

    // 2. Wait for bookings table to load
    await expect(page.getByRole("heading", { name: /预约管理|Bookings/i })).toBeVisible();

    // 3. The test booking should be visible
    await expect(page.getByText(testName).first()).toBeVisible();
    await expect(page.getByText("13800138003").first()).toBeVisible();

    // 4. Status should be "new" (use first matching row)
    const bookingRow = page.locator("tr", { hasText: testName }).first();
    const statusSelect = bookingRow.locator("select").first();
    await expect(statusSelect).toHaveValue("new");

    // 5. Update status to "contacted"
    // Note: handle the prompt dialog
    page.on("dialog", (dialog) => {
      if (dialog.type() === "prompt") {
        dialog.accept("E2E测试联系备注");
      } else {
        dialog.accept();
      }
    });

    await statusSelect.selectOption("contacted");

    // 6. Verify success message
    await expect(page.getByText(/状态已更新|updated|成功/i)).toBeVisible();

    // 7. Verify status changed
    await expect(statusSelect).toHaveValue("contacted");
  });

  test("管理员可以查看预约详情", async ({ page }) => {
    await page.goto("/admin/bookings");

    // Find the test booking row (first match)
    const bookingRow = page.locator("tr", { hasText: testName }).first();
    await expect(bookingRow).toBeVisible();

    // Click "查看详情" link
    const detailLink = bookingRow.getByRole("link", { name: /查看|View|详情|Detail/i }).first();
    await detailLink.click();

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/admin\/bookings\/.+/);

    // Should show booking details
    await expect(page.getByText(testName)).toBeVisible();
    await expect(page.getByText("13800138003")).toBeVisible();
  });

  test("非法状态流转应该被阻止", async ({ page }) => {
    // This test verifies the backend validation by attempting an illegal transition
    // We test this via API since the UI should already filter options,
    // but the backend must enforce it as the source of truth.

    if (!testBookingId || !adminCookie) {
      test.skip(true, "No test booking available");
      return;
    }

    // Try to transition from contacted → new (should fail)
    try {
      await updateBookingStatus(adminCookie, testBookingId, "new");
      throw new Error("Should have thrown for illegal transition");
    } catch (err) {
      expect((err as Error).message).toMatch(/Cannot transition|INVALID_TRANSITION|非法/i);
    }
  });
});
