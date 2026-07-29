import { expect, test } from "@playwright/test";
import {
  createClosureFixture,
  type ClosureFixture,
  waitForDatabaseRow,
} from "./fixtures/closure-database";
import {
  closureContact,
  submitClosureOrdinaryForm,
  transitionFromAdmin,
} from "./fixtures/closure-ui";
import {
  deleteMailpitMessagesFor,
  setMailpitRecipientFailure,
  waitForMailpitMessage,
} from "./fixtures/mailpit";

test("failed customer email is visible in Chinese admin and can be retried", async ({
  page,
}) => {
  let fixture: ClosureFixture | undefined;
  let recipients: string[] = [];
  let chaosEnabled = false;
  try {
    fixture = await createClosureFixture("experience");
    const contact = closureContact(fixture.label);
    recipients = [contact.email];

    const bookingId = await submitClosureOrdinaryForm({
      page,
      fixture,
      contact,
      participantCount: 1,
    });
    fixture.requestIds.add(bookingId);
    await waitForMailpitMessage({
      recipient: contact.email,
      subjectIncludes: "Booking Request Received",
    });
    await waitForDatabaseRow(async () => {
      const [row] = await fixture!.sql<{ sentCount: number }[]>`
        select count(*)::int as "sentCount"
        from email_outbox
        where booking_id = ${bookingId}
          and message_type in (
            'booking_received_customer',
            'booking_notification_owner'
          )
          and delivery_status = 'sent'
      `;
      return row?.sentCount === 2 ? row : null;
    }, "completed initial customer and owner email drain");

    await setMailpitRecipientFailure(true);
    chaosEnabled = true;
    const transition = await transitionFromAdmin({
      page,
      kind: "bookings",
      requestId: bookingId,
      actionName: "确认预约",
    });

    const loadStatusEmail = async () => {
      const [row] = await fixture!.sql<{
        id: string;
        deliveryStatus: string;
        attemptCount: number;
        lastError: string | null;
      }[]>`
        select
          id,
          delivery_status as "deliveryStatus",
          attempt_count as "attemptCount",
          last_error as "lastError"
        from email_outbox
        where booking_id = ${bookingId}
          and status_event_id = (
            select id
            from request_status_events
            where operation_id = ${transition.operationId}
          )
          and message_type = 'booking_notification_customer'
      `;
      return row ?? null;
    };
    const enqueued = await waitForDatabaseRow(
      loadStatusEmail,
      "enqueued status email",
    );
    await expect
      .poll(loadStatusEmail, {
        message: "Mailpit 550 must become a permanent outbox failure",
        timeout: 10_000,
      })
      .toMatchObject({
        deliveryStatus: "failed",
        attemptCount: 1,
      });
    const failed = (await loadStatusEmail())!;
    expect(failed.id).toBe(enqueued.id);
    expect(failed.attemptCount).toBe(1);
    expect(failed.lastError).toContain("550");

    await page.goto(`/admin/bookings/${bookingId}`);
    const failedDelivery = page
      .locator("li")
      .filter({ hasText: "预约流程通知（客户）" })
      .filter({ hasText: contact.email });
    await expect(failedDelivery).toContainText("发送失败");
    await expect(failedDelivery).toContainText("尝试 1 次");

    await setMailpitRecipientFailure(false);
    chaosEnabled = false;
    await page.goto("/admin/email-deliveries");
    await page.getByLabel("发送状态").selectOption("failed");
    const deliveryRow = page
      .locator("tbody tr")
      .filter({ hasText: contact.email })
      .filter({ hasText: "发送失败" });
    await expect(deliveryRow).toContainText("发送失败");
    await deliveryRow.getByRole("button", { name: "重新发送" }).click();
    await expect(page.getByText("已重新加入发送队列")).toBeVisible();

    const sent = await waitForDatabaseRow(async () => {
      const [row] = await fixture!.sql<{
        deliveryStatus: string;
        attemptCount: number;
        providerMessageId: string | null;
      }[]>`
        select
          delivery_status as "deliveryStatus",
          attempt_count as "attemptCount",
          provider_message_id as "providerMessageId"
        from email_outbox
        where id = ${failed.id}
      `;
      return row?.deliveryStatus === "sent" ? row : null;
    }, "manually retried customer email");
    expect(sent.attemptCount).toBe(1);
    expect(sent.providerMessageId).toBeTruthy();
    await waitForMailpitMessage({
      recipient: contact.email,
      subjectIncludes: "Booking Confirmed",
    });

    await page.reload();
    await page.getByLabel("发送状态").selectOption("sent");
    await expect(
      page
        .locator("tbody tr")
        .filter({ hasText: contact.email })
        .filter({ hasText: "预约流程通知（客户）" }),
    ).toContainText("已发送");
  } finally {
    if (chaosEnabled) await setMailpitRecipientFailure(false);
    await deleteMailpitMessagesFor(recipients);
    await fixture?.cleanup();
  }
});
