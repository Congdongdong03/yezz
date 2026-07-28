import { describe, expect, it } from "vitest";
import { buildAuthCookieOptions } from "./auth-cookie.js";

describe("authentication cookie options", () => {
  it("uses a 24 hour maxAge expressed in seconds", () => {
    expect(buildAuthCookieOptions(true)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 86_400,
    });
  });
});
