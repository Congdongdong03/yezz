import { bookingPartyDetails, partyPackages } from "@yezz/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../test-utils/request-flow-postgres.js";
import { createPartyWorkflowRepository } from "./party-workflow.repository.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)("party workflow repository", () => {
  let database: RequestFlowTestDatabase;
  let packageId: string;

  beforeEach(async () => {
    database = await createRequestFlowTestDatabase();
    packageId = crypto.randomUUID();
    await database.connection.db.insert(partyPackages).values({
      id: packageId,
      name: { en: "Party", zh: "派对" },
      slug: `party-${packageId}`,
      minPeople: 4,
      maxPeople: 8,
    });
  });

  afterEach(async () => database.close());

  it("persists party request details separately without creating an interval", async () => {
    const repo = createPartyWorkflowRepository(database.connection.db);
    const created = await repo.createRequest({
      partyPackageId: packageId,
      name: "Mei", phone: "0430000000", email: "mei@example.com",
      birthdayChildName: "Kai", birthdayChildAge: 6,
      participantCount: 4, parentCount: 1,
      desiredDate: "2030-08-12", desiredStartTime: "12:00",
      projectInterests: ["beads"],
      byoCake: true, byoDrinks: false, byoFood: false, byoSnacks: false,
      cakeCuttingRequested: false, locale: "en", policyVersion: "2026-07-29",
      idempotencyKey: crypto.randomUUID(),
      offeringNameSnapshot: { en: "Party", zh: "派对" },
      venueFeeCents: 9500, minSpendPerPersonCents: 4500,
    });
    const [details] = await database.connection.db.select().from(bookingPartyDetails)
      .where(eq(bookingPartyDetails.bookingId, created.id));

    expect(created).toMatchObject({ status: "pending_review", slotDate: null, slotStartTime: null, slotEndTime: null });
    expect(details).toMatchObject({ desiredDate: "2030-08-12", desiredStartTime: "12:00", participantCount: 4, parentCount: 1 });
  });
});
