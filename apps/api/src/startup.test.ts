import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadEnv = vi.hoisted(() => vi.fn());
const originalNodeEnv = process.env.NODE_ENV;
const originalEmailFrom = process.env.EMAIL_FROM;
const originalWorkerEnabled = process.env.EMAIL_OUTBOX_WORKER_ENABLED;
const originalMaintenanceWorkerEnabled =
  process.env.BOOKING_MAINTENANCE_WORKER_ENABLED;
const originalReplyTo = process.env.EMAIL_REPLY_TO;
const originalOwnerEmail = process.env.OWNER_EMAIL;
const originalResendApiKey = process.env.RESEND_API_KEY;
const originalCustomerActionTokenSecret =
  process.env.CUSTOMER_ACTION_TOKEN_SECRET;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

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
    if (originalMaintenanceWorkerEnabled === undefined)
      delete process.env.BOOKING_MAINTENANCE_WORKER_ENABLED;
    else
      process.env.BOOKING_MAINTENANCE_WORKER_ENABLED =
        originalMaintenanceWorkerEnabled;
    if (originalReplyTo === undefined) delete process.env.EMAIL_REPLY_TO;
    else process.env.EMAIL_REPLY_TO = originalReplyTo;
    if (originalOwnerEmail === undefined) delete process.env.OWNER_EMAIL;
    else process.env.OWNER_EMAIL = originalOwnerEmail;
    if (originalResendApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalResendApiKey;
    if (originalCustomerActionTokenSecret === undefined)
      delete process.env.CUSTOMER_ACTION_TOKEN_SECRET;
    else
      process.env.CUSTOMER_ACTION_TOKEN_SECRET =
        originalCustomerActionTokenSecret;
    if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
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

  it("requires the same complete production mail configuration when maintenance is enabled", async () => {
    loadEnv.mockImplementation(() => {
      process.env.EMAIL_OUTBOX_WORKER_ENABLED = "false";
      process.env.BOOKING_MAINTENANCE_WORKER_ENABLED = "true";
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

  it("does not require provider credentials when both mail-producing workers are disabled", async () => {
    loadEnv.mockImplementation(() => {
      process.env.EMAIL_OUTBOX_WORKER_ENABLED = "false";
      process.env.BOOKING_MAINTENANCE_WORKER_ENABLED = "false";
      process.env.EMAIL_FROM = "YezYY <bookings@yezyy.com>";
      delete process.env.EMAIL_REPLY_TO;
      delete process.env.OWNER_EMAIL;
      delete process.env.RESEND_API_KEY;
    });
    const { loadConfiguredApp } = await import("./startup.js");

    await expect(
      loadConfiguredApp(async () => ({ buildApp: vi.fn() })),
    ).resolves.toMatchObject({ buildApp: expect.any(Function) });
  });

  it("accepts complete mail configuration when both workers are enabled", async () => {
    loadEnv.mockImplementation(() => {
      process.env.EMAIL_OUTBOX_WORKER_ENABLED = "true";
      process.env.BOOKING_MAINTENANCE_WORKER_ENABLED = "true";
      process.env.EMAIL_FROM = "YezYY <bookings@yezyy.com>";
      process.env.EMAIL_REPLY_TO = "congdongdong03@gmail.com";
      process.env.OWNER_EMAIL = "congdongdong03@gmail.com";
      process.env.RESEND_API_KEY = "resend-key";
      process.env.CUSTOMER_ACTION_TOKEN_SECRET =
        "production-customer-action-secret-32-bytes";
      process.env.NEXT_PUBLIC_SITE_URL = "https://yezyy.com";
    });
    const { loadConfiguredApp } = await import("./startup.js");

    await expect(
      loadConfiguredApp(async () => ({ buildApp: vi.fn() })),
    ).resolves.toMatchObject({ buildApp: expect.any(Function) });
  });

  it("requires a strong customer-action secret before maintenance starts", async () => {
    loadEnv.mockImplementation(() => {
      process.env.EMAIL_OUTBOX_WORKER_ENABLED = "false";
      process.env.BOOKING_MAINTENANCE_WORKER_ENABLED = "true";
      process.env.EMAIL_FROM = "YezYY <bookings@yezyy.com>";
      process.env.EMAIL_REPLY_TO = "congdongdong03@gmail.com";
      process.env.OWNER_EMAIL = "congdongdong03@gmail.com";
      process.env.RESEND_API_KEY = "resend-key";
      process.env.CUSTOMER_ACTION_TOKEN_SECRET = "too-short";
      process.env.NEXT_PUBLIC_SITE_URL = "https://yezyy.com";
    });
    const { loadConfiguredApp } = await import("./startup.js");

    await expect(
      loadConfiguredApp(async () => ({ buildApp: vi.fn() })),
    ).rejects.toThrow("CUSTOMER_ACTION_TOKEN_SECRET");
  });

  it.each([undefined, "http://localhost:3000", "javascript:alert(1)"])(
    "rejects an unsafe production management origin %s",
    async (siteUrl) => {
      loadEnv.mockImplementation(() => {
        process.env.EMAIL_OUTBOX_WORKER_ENABLED = "false";
        process.env.BOOKING_MAINTENANCE_WORKER_ENABLED = "true";
        process.env.EMAIL_FROM = "YezYY <bookings@yezyy.com>";
        process.env.EMAIL_REPLY_TO = "congdongdong03@gmail.com";
        process.env.OWNER_EMAIL = "congdongdong03@gmail.com";
        process.env.RESEND_API_KEY = "resend-key";
        process.env.CUSTOMER_ACTION_TOKEN_SECRET =
          "production-customer-action-secret-32-bytes";
        if (siteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
        else process.env.NEXT_PUBLIC_SITE_URL = siteUrl;
      });
      const { loadConfiguredApp } = await import("./startup.js");

      await expect(
        loadConfiguredApp(async () => ({ buildApp: vi.fn() })),
      ).rejects.toThrow("NEXT_PUBLIC_SITE_URL");
    },
  );
});
