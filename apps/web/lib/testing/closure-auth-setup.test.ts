import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("closure auth setup isolation", () => {
  it("contains no host Redis shell cleanup", () => {
    const source = readFileSync(
      new URL("../../e2e/auth.setup.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("redis-cli");
    expect(source).not.toContain("execSync");
  });
});
