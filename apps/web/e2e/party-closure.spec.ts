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

test("party request closes through public UI, Chinese admin, email, and database", async ({
  page,
}) => {
  let fixture: ClosureFixture | undefined;
  let recipients: string[] = [];
  try {
    fixture = await createClosureFixture("party");
    const contact = closureContact(fixture.label);
    recipients = [contact.email];

    await page.goto("/en/parties");
    const packageHeading = page.getByRole("heading", {
      name: fixture.offering.en,
    });
    await expect(packageHeading).toBeVisible();
    const packageCard = page.locator(`#${fixture.slug}`);
    await packageCard
      .getByRole("button", { name: "Request this package" })
      .click();
    await packageCard.getByLabel(/^Name/).fill(contact.name);
    await packageCard.getByLabel(/^Phone/).fill(contact.phone);
    await packageCard.getByLabel(/^Email/).fill(contact.email);
    await selectClosureSlot(packageCard.page(), fixture);

    const bookingId = await captureCreatedRequest(
      page,
      "bookings",
      async () => {
        await packageCard
          .getByRole("button", { name: "Send party request" })
          .click();
      },
    );
    fixture.requestIds.add(bookingId);
    await expect(
      packageCard.getByRole("heading", { name: /Request received/i }),
    ).toBeVisible();
    await waitForMailpitMessage({
      recipient: contact.email,
      subjectIncludes: "Booking Request Received",
    });

    await page.goto(`/admin/bookings/${bookingId}`);
    await expect(
      page.getByRole("heading", { name: "聚会预约详情" }),
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
      actionName: "标记为已联系",
    });
    expect(transition).toMatchObject({
      status: "contacted",
      expectedStatus: "new",
    });
    await expect(page.getByText("当前：已联系")).toBeVisible();
    await waitForMailpitMessage({
      recipient: contact.email,
      subjectIncludes: "booking update",
    });

    const finalState = await waitForDatabaseRow(async () => {
      const [row] = await fixture!.sql<{
        status: string;
        partyPackageId: string;
        timeSlotId: string;
        numberOfPeople: number;
        bookedCount: number;
        eventCount: number;
        statusEmailCount: number;
        sentStatusEmailCount: number;
      }[]>`
        select
          b.status,
          b.party_package_id as "partyPackageId",
          b.time_slot_id as "timeSlotId",
          b.number_of_people as "numberOfPeople",
          t.booked_count as "bookedCount",
          (
            select count(*)::int
            from request_status_events e
            where e.booking_id = b.id
              and e.operation_id = ${transition.operationId}
              and e.to_status = 'contacted'
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
      return row?.status === "contacted" && row.sentStatusEmailCount === 1
        ? row
        : null;
    }, "contacted party request and sent customer email");

    expect(finalState).toMatchObject({
      status: "contacted",
      partyPackageId: fixture.partyPackageId,
      timeSlotId: fixture.slotId,
      numberOfPeople: 4,
      bookedCount: 4,
      eventCount: 1,
      statusEmailCount: 1,
      sentStatusEmailCount: 1,
    });
  } finally {
    await deleteMailpitMessagesFor(recipients);
    await fixture?.cleanup();
  }
});
