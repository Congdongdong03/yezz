import { expect, test } from "@playwright/test";
import {
  createClosureFixture,
  type ClosureFixture,
  waitForDatabaseRow,
} from "./fixtures/closure-database";
import {
  captureCreatedRequest,
  closureContact,
  selectClosureSlot,
  transitionFromAdmin,
  type StatusTransitionBody,
} from "./fixtures/closure-ui";
import {
  deleteMailpitMessagesFor,
  waitForMailpitMessage,
} from "./fixtures/mailpit";

test("product request cancellation is idempotent across UI, BFF, email, and capacity", async ({
  page,
}) => {
  let fixture: ClosureFixture | undefined;
  let recipients: string[] = [];
  try {
    fixture = await createClosureFixture("product");
    const contact = closureContact(fixture.label);
    recipients = [contact.email];

    await page.goto(`/en/projects/${fixture.slug}`);
    await expect(
      page.getByRole("heading", { name: fixture.offering.en }),
    ).toBeVisible();
    await page.getByRole("button", { name: fixture.style!.en }).click();
    await page.getByRole("button", { name: "Add to Cart" }).click();
    await page.getByRole("link", { name: "Go to cart" }).click();
    await expect(
      page.getByRole("heading", { name: "Booking Request" }),
    ).toBeVisible();
    await page.getByLabel("Number of People").fill("3");
    await selectClosureSlot(page, fixture);
    await page.getByLabel(/^Name/).fill(contact.name);
    await page.getByLabel(/^Phone/).fill(contact.phone);
    await page.getByLabel(/^Email/).fill(contact.email);

    const orderId = await captureCreatedRequest(
      page,
      "cart-orders",
      async () => {
        await page
          .getByRole("button", { name: "Submit Booking Request" })
          .click();
      },
    );
    fixture.requestIds.add(orderId);
    await expect(
      page.getByRole("heading", { name: "Booking Request Received" }),
    ).toBeVisible();
    await waitForMailpitMessage({
      recipient: contact.email,
      subjectIncludes: "Booking Request Received",
    });

    await page.goto(`/admin/orders/${orderId}`);
    await expect(
      page.getByRole("heading", { name: "产品预约详情" }),
    ).toBeVisible();
    await expect(page.getByText(fixture.offering.zh)).toBeVisible();
    await expect(page.getByText(fixture.style!.zh)).toBeVisible();
    await expect(page.getByText(contact.phone)).toBeVisible();
    await expect(
      page.getByRole("link", { name: contact.email, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        `${fixture.slotDate} ${fixture.slotStartTime}–${fixture.slotEndTime}`,
      ),
    ).toBeVisible();

    const transition = await transitionFromAdmin({
      page,
      kind: "orders",
      requestId: orderId,
      actionName: "取消预约",
      note: "闭环取消",
    });
    expect(transition).toMatchObject({
      status: "cancelled",
      expectedStatus: "new",
      note: "闭环取消",
    });
    await expect(page.getByText("已取消", { exact: true })).toBeVisible();

    const replay = await page.evaluate(
      async ({ id, body }) => {
        const response = await fetch(
          `/api/backend/v1/admin/orders/${id}/status`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        return { status: response.status, body: await response.json() };
      },
      { id: orderId, body: transition as StatusTransitionBody },
    );
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({
      success: true,
      data: { id: orderId, status: "cancelled" },
    });
    await waitForMailpitMessage({
      recipient: contact.email,
      subjectIncludes: "booking cancelled",
    });

    const finalState = await waitForDatabaseRow(async () => {
      const [row] = await fixture!.sql<{
        status: string;
        timeSlotId: string;
        numberOfPeople: number;
        bookedCount: number;
        eventCount: number;
        statusEmailCount: number;
        sentStatusEmailCount: number;
        projectId: string;
        styleId: string;
      }[]>`
        select
          o.status,
          o.time_slot_id as "timeSlotId",
          o.number_of_people as "numberOfPeople",
          t.booked_count as "bookedCount",
          i.project_id as "projectId",
          i.style_id as "styleId",
          (
            select count(*)::int
            from request_status_events e
            where e.cart_order_id = o.id
              and e.operation_id = ${transition.operationId}
              and e.to_status = 'cancelled'
          ) as "eventCount",
          (
            select count(*)::int
            from email_outbox e
            where e.cart_order_id = o.id
              and e.message_type = 'cart_order_status_customer'
          ) as "statusEmailCount",
          (
            select count(*)::int
            from email_outbox e
            where e.cart_order_id = o.id
              and e.message_type = 'cart_order_status_customer'
              and e.delivery_status = 'sent'
          ) as "sentStatusEmailCount"
        from cart_orders o
        join time_slots t on t.id = o.time_slot_id
        join cart_order_items i on i.order_id = o.id
        where o.id = ${orderId}
      `;
      return row?.status === "cancelled" && row.sentStatusEmailCount === 1
        ? row
        : null;
    }, "idempotently cancelled product request");

    expect(finalState).toMatchObject({
      status: "cancelled",
      timeSlotId: fixture.slotId,
      numberOfPeople: 3,
      bookedCount: 0,
      eventCount: 1,
      statusEmailCount: 1,
      sentStatusEmailCount: 1,
      projectId: fixture.projectId,
      styleId: fixture.styleId,
    });
  } finally {
    await deleteMailpitMessagesFor(recipients);
    await fixture?.cleanup();
  }
});
