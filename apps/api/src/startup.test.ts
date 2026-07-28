import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadEnv = vi.hoisted(() => vi.fn());
const originalNodeEnv = process.env.NODE_ENV;
const originalEmailFrom = process.env.EMAIL_FROM;
const originalWorkerEnabled = process.env.EMAIL_OUTBOX_WORKER_ENABLED;
const originalReplyTo = process.env.EMAIL_REPLY_TO;
const originalOwnerEmail = process.env.OWNER_EMAIL;
const originalResendApiKey = process.env.RESEND_API_KEY;

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
    if (originalWorkerEnabled === undefined)
      delete process.env.EMAIL_OUTBOX_WORKER_ENABLED;
    else process.env.EMAIL_OUTBOX_WORKER_ENABLED = originalWorkerEnabled;
    if (originalReplyTo === undefined) delete process.env.EMAIL_REPLY_TO;
    else process.env.EMAIL_REPLY_TO = originalReplyTo;
    if (originalOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
    else process.env.OWNER_EMAIL = originalOwnerEmail;
    if (originalResendApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalResendApiKey;
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

  it("requires complete production email configuration when the outbox worker is enabled", async () => {
    loadEnv.mockImplementation(() => {
      process.env.EMAIL_OUTBOX_WORKER_ENABLED = "true";
      process.env.EMAIL_FROM = "YezYY <bookings@yezyy.com>";
      process.env.EMAIL_REPLY_TO = "congdongdong03@gmail.com";
      process.env.OWNER_EMAIL = "congdongdong03@gmail.com";
      delete process.env.RESEND_API_KEY;
    });
    const { loadConfiguredApp } = await import("./startup.js");

    await expect(
      loadConfiguredApp(async () => ({ buildApp: vi.fn() })),
    ).rejects.toThrow("RESEND_API_KEY");
  });
});
