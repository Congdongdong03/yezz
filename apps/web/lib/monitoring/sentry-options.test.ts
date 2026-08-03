import { describe, expect, it } from "vitest";
import { sentryTraceSampleRate } from "./sentry-options";

describe("sentryTraceSampleRate", () => {
  it("uses a low production-safe default", () => {
    expect(sentryTraceSampleRate(undefined)).toBe(0.05);
  });

  it("accepts only rates from zero through one", () => {
    expect(sentryTraceSampleRate("0.2")).toBe(0.2);
    expect(sentryTraceSampleRate("2")).toBe(0.05);
    expect(sentryTraceSampleRate("invalid")).toBe(0.05);
  });
});
