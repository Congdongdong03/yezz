import { users } from "@yezz/db";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createRequestFlowTestDatabase,
  type RequestFlowTestDatabase,
} from "../../test-utils/request-flow-postgres.js";
import { createAdminUsersService } from "./users.admin.service.js";

const runDatabaseTests = process.env.YEZYY_RUN_DB_BOOKING_TESTS === "1";

describe.skipIf(!runDatabaseTests)(
  "admin users service PostgreSQL owner invariant",
  () => {
    let database: RequestFlowTestDatabase | undefined;

    beforeEach(async () => {
      database = await createRequestFlowTestDatabase();
    });

    afterEach(async () => {
      await database?.close();
      database = undefined;
    });

    it("serializes a simultaneous Owner demotion and deletion so one Owner remains", async () => {
      const [firstOwner, secondOwner] = await database!.connection.db
        .insert(users)
        .values([
          {
            email: "first-owner@example.test",
            passwordHash: "integration-safe-hash",
            name: "First Owner",
            role: "owner",
          },
          {
            email: "second-owner@example.test",
            passwordHash: "integration-safe-hash",
            name: "Second Owner",
            role: "owner",
          },
        ])
        .returning();
      const service = createAdminUsersService(database!.connection.db);
      const actor = {
        sub: firstOwner!.id,
        email: firstOwner!.email,
        role: "owner" as const,
        sessionVersion: firstOwner!.sessionVersion,
      };
      await database!.connection.client.unsafe(`
        CREATE FUNCTION delay_owner_mutation() RETURNS trigger AS $$
        BEGIN
          IF OLD.role = 'owner' THEN
            PERFORM pg_sleep(0.2);
          END IF;
          IF TG_OP = 'UPDATE' THEN
            RETURN NEW;
          END IF;
          RETURN OLD;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER delay_owner_mutation
          BEFORE UPDATE OR DELETE ON users
          FOR EACH ROW EXECUTE FUNCTION delay_owner_mutation()
      `);

      const results = await Promise.allSettled([
        service.update(firstOwner!.id, { role: "admin" }, actor),
        service.remove(secondOwner!.id, actor),
      ]);

      expect(
        results.filter(({ status }) => status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter(({ status }) => status === "rejected"),
      ).toHaveLength(1);
      const remainingOwners = await database!.connection.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "owner"));
      expect(remainingOwners).toHaveLength(1);
    });
  },
);
