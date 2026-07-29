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

    await page.goto(`/en/projects/${fixture.slug}`);
    await expect(
      page.getByRole("heading", { name: fixture.offering.en }),
    ).toBeVisible();
    await page.getByLabel("Number of People").fill("2");
    await selectClosureSlot(page, fixture);
    await page.getByLabel(/^Name/).fill(contact.name);
    await page.getByLabel(/^Phone/).fill(contact.phone);
    await page.getByLabel(/^Email/).fill(contact.email);

    const bookingId = await captureCreatedRequest(
      page,
      "bookings",
      async () => {
        await page
          .getByRole("button", { name: "Submit Booking Request" })
          .click();
      },
    );
    fixture.requestIds.add(bookingId);
    await expect(
      page.getByRole("heading", { name: "Booking Request Received" }),
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
      expectedStatus: "new",
    });
    await expect(page.getByText("当前：已确认")).toBeVisible();
    await waitForMailpitMessage({
      recipient: contact.email,
      subjectIncludes: "booking confirmed",
    });

    const finalState = await waitForDatabaseRow(async () => {
      const [row] = await fixture!.sql<{
        status: string;
        projectId: string;
        timeSlotId: string;
        numberOfPeople: number;
        bookedCount: number;
        eventCount: number;
        statusEmailCount: number;
        sentStatusEmailCount: number;
      }[]>`
        select
          b.status,
          b.project_id as "projectId",
          b.time_slot_id as "timeSlotId",
          b.number_of_people as "numberOfPeople",
          t.booked_count as "bookedCount",
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
              and o.message_type = 'booking_status_customer'
          ) as "statusEmailCount",
          (
            select count(*)::int
            from email_outbox o
            where o.booking_id = b.id
              and o.message_type = 'booking_status_customer'
              and o.delivery_status = 'sent'
          ) as "sentStatusEmailCount"
        from bookings b
        join time_slots t on t.id = b.time_slot_id
        where b.id = ${bookingId}
      `;
      return row?.status === "confirmed" && row.sentStatusEmailCount === 1
        ? row
        : null;
    }, "confirmed experience request and sent customer email");

    expect(finalState).toMatchObject({
      status: "confirmed",
      projectId: fixture.projectId,
      timeSlotId: fixture.slotId,
      numberOfPeople: 2,
      bookedCount: 2,
      eventCount: 1,
      statusEmailCount: 1,
      sentStatusEmailCount: 1,
    });
  } finally {
    await deleteMailpitMessagesFor(recipients);
    await fixture?.cleanup();
  }
});
