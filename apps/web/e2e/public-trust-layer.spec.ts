import { expect, test } from "@playwright/test";

test("public studio trust journey stays truthful and bookable", async ({
  page,
}) => {
  await page.goto("/en");
  await expect(
    page.getByRole("heading", { name: "Create Your Own Masterpiece" }),
  ).toBeVisible();

  const mobileActions = page.locator('nav[aria-label="Studio actions"]');
  await expect(mobileActions).toHaveCount(1);
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await expect(mobileActions).toBeVisible();
    await expect(
      mobileActions.getByRole("link", { name: "Book DIY" }),
    ).toHaveAttribute("href", /\/en\/book$|\/book$/);
  } else {
    await expect(mobileActions).toBeHidden();
  }
  await expect(mobileActions.locator('a[href*="/cart"]')).toHaveCount(0);

  await page.goto("/en/gallery");
  await expect(
    page.getByRole("heading", { name: "Gallery", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "See how it comes together" }),
  ).toBeVisible();
  await expect(
    page.getByText("Customer moments will appear here"),
  ).toBeVisible();

  await page.goto("/en/contact");
  await expect(
    page.getByRole("heading", { name: "A real studio in Glen Waverley" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Before you arrive" }),
  ).toBeVisible();
  await expect(
    page.getByText("separate visit before the party date", { exact: false }),
  ).toBeVisible();

  await page.goto("/en/parties");
  await expect(
    page.getByRole("heading", { name: "Celebrate at YezYY" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Party questions, answered" }),
  ).toBeVisible();
  const partyFaq = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Party questions, answered" }),
  });
  await partyFaq.getByText("How many people can attend?").click();
  await expect(
    partyFaq.getByText("Packages are for 4–8 DIY participants", {
      exact: false,
    }),
  ).toBeVisible();
  await partyFaq.getByText("How is the deposit paid?").click();
  await expect(
    partyFaq.getByText("There is no online payment", { exact: false }),
  ).toBeVisible();

  await page.goto("/zh/gallery");
  await expect(page.getByText("YezYY 门店日记")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "看看作品如何完成" }),
  ).toBeVisible();

  await page.goto("/zh/parties");
  await expect(
    page.getByRole("heading", { name: "派对常见问题" }),
  ).toBeVisible();
  const partyFaqZh = page.locator("section").filter({
    has: page.getByRole("heading", { name: "派对常见问题" }),
  });
  await partyFaqZh.getByText("订金如何支付？").click();
  await expect(
    partyFaqZh.getByText("派对日期前另行到店", { exact: false }),
  ).toBeVisible();
});
