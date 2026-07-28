import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { displayLocalized, escapeHtml } from "./email-helpers.js";

const sentEmails = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const originalNodeEnv = process.env.NODE_ENV;

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: vi.fn(async (email: Record<string, unknown>) => {
        sentEmails.push(email);
        return { data: null, error: null };
      }),
    };
  },
}));

describe("email helpers", () => {
  it("escapes HTML in user content", () => {
    expect(escapeHtml(`<script>"x"</script>`)).toBe(
      "&lt;script&gt;&quot;x&quot;&lt;/script&gt;",
    );
  });

  it("displays localized strings with en/zh fallback", () => {
    expect(displayLocalized({ en: "Phone Case", zh: "手机壳" })).toBe("Phone Case");
    expect(displayLocalized({ zh: "手机壳" })).toBe("手机壳");
    expect(displayLocalized("plain")).toBe("plain");
    expect(displayLocalized(null)).toBe("N/A");
  });
});

describe("booking request acknowledgement email", () => {
  beforeEach(() => {
    sentEmails.length = 0;
    vi.resetModules();
    process.env.NODE_ENV = "test";
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.EMAIL_FROM = "YezYY <bookings@yezyy.com>";
    process.env.EMAIL_REPLY_TO = "izzybella.chen@gmail.com";
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  const baseOptions = {
    to: "customer@example.com",
    orderId: "request-1234",
    orderNumber: "booking-20260728-1234",
    submittedAt: new Date("2026-07-28T02:00:00.000Z"),
    input: {
      name: "Wesley",
      phone: "0430787712",
      locale: "en",
    },
    contact: { email: "izzybella.chen@gmail.com" },
  };

  it("describes a new submission as awaiting manual confirmation", async () => {
    const { sendBookingConfirmationToCustomer } = await import("./email.js");

    await sendBookingConfirmationToCustomer(baseOptions);

    const sentEmail = sentEmails[0] as { html: string };
    expect(sentEmail.html).toContain("Booking Request Received");
    expect(sentEmail.html).toContain("awaiting confirmation");
    expect(sentEmail.html).toContain("Pay in Store");
    expect(sentEmail.html).not.toContain("Your booking is confirmed");
  });

  it("uses the exact YezYY brand casing", async () => {
    const { sendBookingConfirmationToCustomer } = await import("./email.js");

    await sendBookingConfirmationToCustomer(baseOptions);

    const sentEmail = sentEmails[0] as { subject: string; html: string; replyTo: string };
    expect(sentEmail.subject).toContain("YezYY");
    expect(sentEmail.replyTo).toBe("izzybella.chen@gmail.com");
    expect(sentEmail.html).not.toContain(">YEZZ<");
  });

  it("requires EMAIL_FROM when starting in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.EMAIL_FROM;
    vi.resetModules();

    await expect(import("./email.js")).rejects.toThrow(
      "EMAIL_FROM must be configured in production",
    );
  });
});
