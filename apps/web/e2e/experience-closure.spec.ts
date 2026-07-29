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
  waitForMailpitMessage,
} from "./fixtures/mailpit";

test("experience request closes through public UI, Chinese admin, email, and database", async ({
  page,
}) => {
  let fixture: ClosureFixture | undefined;
  let recipients: string[] = [];
  try {
    fixture = await createClosureFixture("experience");
    const contact = closureContact(fixture.label);
    recipients = [contact.email];

    const bookingId = await submitClosureOrdinaryForm({
      page,
      fixture,
      contact,
      participantCount: 2,
    });
    fixture.requestIds.add(bookingId);
    await expect(
      page.getByRole("heading", { name: "Request received" }),
    ).toBeVisible();
    await waitForMailpitMessage({
      recipient: contact.email,
      subjectIncludes: "Booking Request Received",
    });

    await page.goto(`/admin/bookings/${bookingId}`);
    await expect(
      page.getByRole("heading", { name: "体验预约详情" }),
    ).toBeVisible();
    await expect(page.getByText(fixture.offering.zh)).toBeVisible();
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
      kind: "bookings",
      requestId: bookingId,
      actionName: "确认预约",
    });
    expect(transition).toMatchObject({
      status: "confirmed",
      expectedStatus: "pending_review",
    });
    await expect(page.getByText("当前：已确认")).toBeVisible();
    await waitForMailpitMessage({
      recipient: contact.email,
      subjectIncludes: "Booking Confirmed",
    });

    const finalState = await waitForDatabaseRow(async () => {
      const [row] = await fixture!.sql<{
        status: string;
        projectItemId: string;
        slotDate: string;
        slotStartTime: string;
        slotEndTime: string;
        participantCount: number;
        attendanceCount: number;
        eventCount: number;
        statusEmailCount: number;
        sentStatusEmailCount: number;
      }[]>`
        select
          b.status,
          (
            select i.project_id
            from booking_items i
            where i.booking_id = b.id
            order by i.sort_order
            limit 1
          ) as "projectItemId",
          to_char(b.slot_date, 'YYYY-MM-DD') as "slotDate",
          b.slot_start_time as "slotStartTime",
          b.slot_end_time as "slotEndTime",
          b.participant_count as "participantCount",
          b.attendance_count as "attendanceCount",
          (
            select count(*)::int
            from request_status_events e
            where e.booking_id = b.id
              and e.operation_id = ${transition.operationId}
              and e.to_status = 'confirmed'
          ) as "eventCount",
          (
            select count(*)::int
            from email_outbox o
            where o.booking_id = b.id
            and o.message_type = 'booking_notification_customer'
          ) as "statusEmailCount",
          (
            select count(*)::int
            from email_outbox o
            where o.booking_id = b.id
            and o.message_type = 'booking_notification_customer'
              and o.delivery_status = 'sent'
          ) as "sentStatusEmailCount"
        from bookings b
        where b.id = ${bookingId}
      `;
      return row?.status === "confirmed" && row.sentStatusEmailCount === 1
        ? row
        : null;
    }, "confirmed experience request and sent customer email");

    expect(finalState).toMatchObject({
      status: "confirmed",
      projectItemId: fixture.projectId,
      slotDate: fixture.slotDate,
      slotStartTime: fixture.slotStartTime,
      slotEndTime: fixture.slotEndTime,
      participantCount: 2,
      attendanceCount: 2,
      eventCount: 1,
      statusEmailCount: 1,
      sentStatusEmailCount: 1,
    });
  } finally {
    await deleteMailpitMessagesFor(recipients);
    await fixture?.cleanup();
  }
});
