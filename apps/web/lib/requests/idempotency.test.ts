import { describe, expect, it, vi } from "vitest";
import { createRequestAttempt } from "./idempotency";

describe("createRequestAttempt", () => {
  it("keeps one key after failure and rotates only after confirmed success", () => {
    const generate = vi
      .fn<() => string>()
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002");
    const attempt = createRequestAttempt(generate);

    expect(attempt.current()).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    attempt.failed();
    expect(attempt.current()).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(generate).toHaveBeenCalledTimes(1);

    attempt.succeeded();
    expect(attempt.current()).toBe(
      "00000000-0000-4000-8000-000000000002",
    );
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
