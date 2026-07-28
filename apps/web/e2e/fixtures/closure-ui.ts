import { expect, type Page } from "@playwright/test";
import type { ClosureFixture } from "./closure-database";

type RequestKind = "bookings" | "cart-orders";
type AdminKind = "bookings" | "orders";

export type StatusTransitionBody = {
  status: "contacted" | "confirmed" | "cancelled";
  expectedStatus: "new" | "contacted" | "confirmed" | "cancelled";
  operationId: string;
  note?: string;
};

export function closureContact(label: string) {
  const suffix = label.slice(0, 8);
  return {
    name: `Closure Customer ${suffix}`,
    phone: `0400${suffix.replace(/[^0-9]/g, "").padEnd(6, "7").slice(0, 6)}`,
    email: `closure-${suffix}@example.test`,
  };
}

export async function selectClosureSlot(
  page: Page,
  fixture: ClosureFixture,
): Promise<void> {
  const targetMonth = fixture.slotDate.slice(0, 7);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const dateButton = page.locator(`[data-date="${fixture.slotDate}"]`);
    if (await dateButton.count()) {
      await expect(dateButton).toBeEnabled();
      await dateButton.click();
      const slotButton = page.locator(`[data-slot-id="${fixture.slotId}"]`);
      await expect(slotButton).toBeVisible();
      await expect(slotButton).toBeEnabled();
      await slotButton.click();
      return;
    }
    const shownMonth = await page
      .locator("p.font-medium.text-warm-charcoal")
      .filter({ hasText: /^\d{4}-\d{2}/ })
      .first()
      .textContent();
    if (shownMonth?.includes(targetMonth)) break;
    await page.getByRole("button", { name: /Next month|下个月/ }).click();
  }
  throw new Error(`Closure fixture date ${fixture.slotDate} was not selectable`);
}

export async function captureCreatedRequest(
  page: Page,
  kind: RequestKind,
  submit: () => Promise<void>,
): Promise<string> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `/api/backend/v1/${kind}`,
  );
  await submit();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const payload = (await response.json()) as {
    success: boolean;
    data?: { id?: string };
  };
  expect(payload.success).toBe(true);
  expect(payload.data?.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  return payload.data!.id!;
}

export async function transitionFromAdmin(options: {
  page: Page;
  kind: AdminKind;
  requestId: string;
  actionName: "标记为已联系" | "确认预约" | "取消预约";
  note?: string;
}): Promise<StatusTransitionBody> {
  const { page, kind, requestId, actionName, note } = options;
  const path = `/api/backend/v1/admin/${kind}/${requestId}/status`;
  await page.goto(`/admin/${kind}/${requestId}`);
  await expect(
    page.getByRole("heading", {
      name: kind === "bookings" ? /预约详情/ : /产品预约详情/,
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: actionName, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  if (note) {
    await dialog.getByRole("textbox").fill(note);
  }

  const requestPromise = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      new URL(request.url()).pathname === path,
  );
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname === path,
  );
  await dialog.getByRole("button", { name: actionName, exact: true }).click();
  const [request, response] = await Promise.all([
    requestPromise,
    responsePromise,
  ]);
  expect(response.status()).toBe(200);
  const body = request.postDataJSON() as StatusTransitionBody;
  expect(body.operationId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  return body;
}
