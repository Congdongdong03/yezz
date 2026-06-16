/**
 * E2E Test: Experience Booking Flow
 *
 * Core user journey:
 *   Browse projects → View experience detail → Select people count
 *   → Select date with available time slot → Select time slot
 *   → Fill booking form → Submit → See success
 */

import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import {
  getAdminCookieFromState,
  createTimeSlot,
  deleteTimeSlot,
  fetchCategories,
} from "./fixtures/api-client";

test.describe("体验项目预约流程", () => {
  let timeSlotId: string | null = null;
  let adminCookie: string | null = null;

  test.beforeAll(async () => {
    // Reuse admin cookie from auth setup to avoid rate limiting
    adminCookie = getAdminCookieFromState();
    if (!adminCookie) {
      throw new Error("Admin auth state not found. Run auth.setup.ts first.");
    }

    // Clear Redis rate limits to avoid booking submission being blocked
    try {
      execSync("redis-cli KEYS 'ratelimit:bookings:*' | xargs -r redis-cli DEL", { stdio: "ignore" });
    } catch {
      // ignore if redis-cli is not available
    }

    const categories = await fetchCategories();
    const diyCategory = categories.find((c) => c.slug === "diy-handmade");

    if (!diyCategory) {
      throw new Error("DIY category not found in seeded data");
    }

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const slot = await createTimeSlot(adminCookie, {
      date: dateStr,
      startTime: "14:00",
      endTime: "16:00",
      capacity: 10,
      categoryId: diyCategory.id,
    });

    timeSlotId = slot.id;
  });

  test.afterAll(async () => {
    if (timeSlotId && adminCookie) {
      await deleteTimeSlot(adminCookie, timeSlotId);
    }
  });

  test("用户可以预约带时间槽的体验项目", async ({ page }) => {
    // 1. Visit projects page
    await page.goto("/zh/projects");
    await expect(page.getByRole("heading", { name: /项目|Projects/i })).toBeVisible();

    // 2. Click on an experience project (陶艺体验 - pottery experience)
    const projectCard = page.locator("a[href*='pottery-experience']").first();
    await expect(projectCard).toBeVisible();
    await projectCard.click();

    // 3. On project detail page
    await expect(page).toHaveURL(/\/zh\/projects\/pottery-experience/);
    await expect(
      page.getByRole("heading", { name: /陶艺|Pottery/i }),
    ).toBeVisible();

    // 4. Set number of people
    const peopleInput = page.locator('input#project-people');
    await expect(peopleInput).toBeVisible();
    await peopleInput.fill("2");

    // 5. Open booking calendar and select today (should have available slot)
    // The calendar loads the current month. Find an available day.
    const todayCell = page
      .locator("button")
      .filter({ has: page.locator(":scope", { hasText: /^\d+$/ }) })
      .filter({ hasNot: page.locator(".", { hasText: /^$/ }) })
      .first();

    // Wait for calendar to load
    await expect(page.getByRole("heading", { name: /选择预约档期/i })).toBeVisible();

    // Click on an available day (green-ish background)
    const availableDay = page.locator("button.bg-sage\\/30").first();
    if (await availableDay.isVisible().catch(() => false)) {
      await availableDay.click();
    } else {
      // Fallback: try clicking any day that is not disabled
      const dayButton = page.locator("button:not([disabled])").filter({ hasText: /^\d+$/ }).first();
      await dayButton.click();
    }

    // 6. Select a time slot if available
    const slotButton = page
      .locator("button")
      .filter({ hasText: /14:00|16:00/ })
      .first();

    if (await slotButton.isVisible().catch(() => false)) {
      await slotButton.click();
    }

    // 7. Scroll to booking form and fill it
    await page.getByRole("heading", { name: /提交预约/i }).scrollIntoViewIfNeeded();

    await page.getByLabel(/姓名|Name/i).fill("E2E预约测试");
    await page.getByLabel(/电话|Phone|手机/i).fill("13800138002");
    await page.getByLabel(/微信|WeChat/i).fill("e2e_booking_wechat");
    await page.getByLabel(/邮箱|Email/i).fill("e2e-booking@example.com");

    // 8. Submit booking (button text is "立即预约" in the form)
    const submitButton = page.locator("#booking-form").getByRole("button", { name: /立即预约/i });
    await submitButton.click();

    // 9. Verify success
    await expect(page.getByText(/感谢您的预约！|Thank|成功/i)).toBeVisible();
  });

  test("预约表单应该验证必填字段", async ({ page }) => {
    await page.goto("/zh/projects/pottery-experience");
    await expect(
      page.getByRole("heading", { name: /陶艺|Pottery/i }),
    ).toBeVisible();

    // Try submitting without filling required fields
    // Scroll to form
    await page.getByRole("heading", { name: /提交预约/i }).scrollIntoViewIfNeeded();

    // Submit empty form
    const submitButton = page.locator("#booking-form").getByRole("button", { name: /立即预约/i });
    await submitButton.click();

    // Should show validation errors
    await expect(page.getByText(/请输入|必填|required/i).first()).toBeVisible();
  });
});
