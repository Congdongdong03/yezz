import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadEnv = vi.hoisted(() => vi.fn());
const originalNodeEnv = process.env.NODE_ENV;
const originalEmailFrom = process.env.EMAIL_FROM;

vi.mock("./env.js", () => ({ loadEnv }));

describe("application startup", () => {
  beforeEach(() => {
    vi.resetModules();
    loadEnv.mockReset();
    process.env.NODE_ENV = "production";
    delete process.env.EMAIL_FROM;
    loadEnv.mockImplementation(() => {
      process.env.EMAIL_FROM = "YezYY <bookings@yezyy.com>";
    });
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalEmailFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = originalEmailFrom;
  });

  it("loads root environment before the app evaluates production email configuration", async () => {
    const { loadConfiguredApp } = await import("./startup.js");
    const applicationModule = { buildApp: vi.fn() };

    await expect(
      loadConfiguredApp(async () => {
        expect(process.env.EMAIL_FROM).toBe("YezYY <bookings@yezyy.com>");
        return applicationModule;
      }),
    ).resolves.toBe(applicationModule);
    expect(loadEnv).toHaveBeenCalledOnce();
  });
});
