import { describe, expect, it } from "vitest";
import {
  sealPasswordSetupToken,
  unsealPasswordSetupToken,
} from "./password-setup-seal.js";

const token = "A".repeat(43);
const secret = "password-setup-seal-test-secret-at-least-32-bytes";

describe("password setup token seal", () => {
  it("round trips without embedding the raw token", () => {
    const sealed = sealPasswordSetupToken(token, secret, () => Buffer.alloc(12, 7));

    expect(sealed).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(sealed).not.toContain(token);
    expect(unsealPasswordSetupToken(sealed, secret)).toBe(token);
  });

  it("rejects a wrong secret and tampering", () => {
    const sealed = sealPasswordSetupToken(token, secret);
    const [version, iv, ciphertext, tag] = sealed.split(".");
    const tamperedCiphertext = Buffer.from(ciphertext!, "base64url");
    tamperedCiphertext[0] ^= 1;
    const tampered = [
      version,
      iv,
      tamperedCiphertext.toString("base64url"),
      tag,
    ].join(".");

    expect(() =>
      unsealPasswordSetupToken(
        sealed,
        "different-password-setup-secret-at-least-32-bytes",
      ),
    ).toThrow(/could not be opened/);
    expect(() => unsealPasswordSetupToken(tampered, secret)).toThrow(
      /could not be opened/,
    );
  });

  it("rejects weak secrets and malformed tokens", () => {
    expect(() => sealPasswordSetupToken(token, "too-short")).toThrow(
      /at least 32 bytes/,
    );
    expect(() => sealPasswordSetupToken("short", secret)).toThrow(
      /invalid format/,
    );
  });
});
