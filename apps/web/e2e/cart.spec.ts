/**
 * E2E Test: Cart Order Flow (Product)
 *
 * Core user journey:
 *   Browse projects → View product detail → Select style → Add to cart
 *   → Go to cart → Fill contact info → Submit order → See success
 */

import { test, expect } from "@playwright/test";

test.describe("购物车下单流程", () => {
  test("用户可以将产品加入购物车并提交订单", async ({ page }) => {
    // 1. Visit projects page
    await page.goto("/zh/projects");
    await expect(page.getByRole("heading", { name: /项目|Projects/i })).toBeVisible();

    // 2. Click on a product project (奶油胶手机壳 - cream glue phone case)
    const projectCard = page.locator("a[href*='cream-glue-phone-case']").first();
    await expect(projectCard).toBeVisible();
    await projectCard.click();

    // 3. On project detail page
    await expect(page).toHaveURL(/\/zh\/projects\/cream-glue-phone-case/);
    await expect(
      page.getByRole("heading", { name: /奶油胶|Cream Glue/i }),
    ).toBeVisible();

    // 4. Select a style
    const styleButton = page.locator("button", { hasText: /粉色小熊|Pastel Pink/ }).first();
    await expect(styleButton).toBeVisible();
    await styleButton.click();

    // 5. Add to cart
    const addToCartButton = page.getByRole("button", { name: /加入预选单/i });
    await expect(addToCartButton).toBeVisible();
    await addToCartButton.click();

    // 6. Cart drawer should open (or toast appears)
    await expect(page.getByText(/已添加！/)).toBeVisible();

    // 7. Navigate to cart page
    await page.goto("/zh/cart");
    await expect(page.getByRole("heading", { name: /预约确认/i })).toBeVisible();

    // 8. Cart should contain the item
    await expect(page.getByText(/奶油胶|Cream Glue/)).toBeVisible();
    await expect(page.getByText(/粉色小熊|Pastel Pink/)).toBeVisible();

    // 9. Fill contact form
    await page.getByLabel(/姓名|Name/i).fill("E2E测试用户");
    await page.getByLabel(/电话|Phone|手机/i).fill("13800138001");
    await page.getByLabel(/微信|WeChat/i).fill("e2e_test_wechat");
    await page.getByLabel(/邮箱|Email/i).fill("e2e-test@example.com");
    await page.getByLabel(/备注|Note|Message/i).fill("E2E自动化测试订单");

    // 10. Submit order
    const submitButton = page.getByRole("button", { name: /确认|提交|Submit|Confirm/i });
    await submitButton.click();

    // 11. Verify success
    await expect(page.getByText(/感谢您的预约！|Thank|Success/i)).toBeVisible();

    // 12. Cart should be empty after successful submission
    await page.goto("/zh/cart");
    await expect(page.getByText(/空|Empty|暂无/i)).toBeVisible();
  });

  test("空购物车应该显示空状态", async ({ page }) => {
    await page.goto("/zh/cart");
    await expect(page.getByText(/预选单是空的|Empty/i)).toBeVisible();
  });
});
