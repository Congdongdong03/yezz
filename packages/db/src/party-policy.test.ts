import { expect, it } from "vitest";
import { PARTY_MINIMUM_BIRTHDAY_AGE } from "./party-policy.js";

it("keeps the owner-approved party birthday minimum at five", () => {
  expect(PARTY_MINIMUM_BIRTHDAY_AGE).toBe(5);
});
