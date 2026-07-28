import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { displayLocalized, escapeHtml } from "./email-helpers.js";

const sentEmails = vi.hoisted(() => [] as Array<Record<string, unknown>>);
const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
  OWNER_EMAIL: process.env.OWNER_EMAIL,
};

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

describe("staff credential emails", () => {
  beforeEach(() => {
    sentEmails.length = 0;
    vi.resetModules();
    process.env.NODE_ENV = "test";
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.EMAIL_FROM = "YezYY <bookings@yezyy.com>";
    process.env.EMAIL_REPLY_TO = "congdongdong03@gmail.com";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("does not send a plaintext temporary password by email", async () => {
    const { sendStaffWelcomeEmail } = await import("./email.js");

    await sendStaffWelcomeEmail({
      to: "staff@example.com",
      name: "Staff",
      email: "staff@example.com",
      role: "staff",
    });

    const sentEmail = sentEmails[0] as { html: string };
    expect(sentEmail.html).toContain("obtain your temporary password from your administrator");
    expect(sentEmail.html).not.toContain("SafeTemporary42!");
    expect(sentEmail.html).not.toContain("Password / 初始密码");
  });
});

describe("booking request acknowledgement email", () => {
  beforeEach(() => {
    sentEmails.length = 0;
    vi.resetModules();
    process.env.NODE_ENV = "test";
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.EMAIL_FROM = "YezYY <bookings@yezyy.com>";
    process.env.EMAIL_REPLY_TO = "congdongdong03@gmail.com";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
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
    contact: { email: "congdongdong03@gmail.com" },
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

    const sentEmail = sentEmails[0] as {
      from: string;
      subject: string;
      html: string;
      replyTo: string;
    };
    expect(sentEmail.subject).toContain("YezYY");
    expect(sentEmail.from).toBe("YezYY <bookings@yezyy.com>");
    expect(sentEmail.replyTo).toBe("congdongdong03@gmail.com");
    expect(sentEmail.html).not.toContain(">YEZZ<");
  });

  it("keeps cart acknowledgements pending and pay-in-store", async () => {
    const { sendOrderConfirmationToCustomer } = await import("./email.js");

    await sendOrderConfirmationToCustomer({
      to: "customer@example.com",
      orderNumber: "order-20260728-1234",
      submittedAt: new Date("2026-07-28T02:00:00.000Z"),
      input: {
        name: "Wesley",
        phone: "0430787712",
        items: [{ projectName: { en: "Melty Bead Craft", zh: "拼豆" } }],
      },
      contact: { email: "congdongdong03@gmail.com" },
    });

    const sentEmail = sentEmails[0] as { subject: string; html: string };
    expect(sentEmail.subject).toContain("YezYY Booking Request Received");
    expect(sentEmail.html).toContain("awaiting confirmation");
    expect(sentEmail.html).toContain("Pay in Store");
    expect(sentEmail.html).not.toContain("Your booking is confirmed");
  });

  it("uses the configured reply address for owner and later status emails", async () => {
    process.env.OWNER_EMAIL = "owner@example.com";
    const {
      sendBookingStatusCancelledEmail,
      sendBookingStatusConfirmedEmail,
      sendOwnerEmail,
    } = await import("./email.js");
    const statusContext = {
      to: "customer@example.com",
      locale: "en",
      customerName: "Wesley",
      orderNumber: "booking-20260728-1234",
      storeName: "YezYY",
      contact: { email: "congdongdong03@gmail.com" },
    };

    await sendOwnerEmail("New request", "<p>Request</p>");
    await sendBookingStatusConfirmedEmail(statusContext);
    await sendBookingStatusCancelledEmail(statusContext);

    const [owner, confirmed, cancelled] = sentEmails as Array<{
      replyTo: string;
      subject: string;
      html: string;
    }>;
    expect(owner.replyTo).toBe("congdongdong03@gmail.com");
    expect(confirmed.replyTo).toBe("congdongdong03@gmail.com");
    expect(cancelled.replyTo).toBe("congdongdong03@gmail.com");
    expect(confirmed.subject).toContain("booking confirmed");
    expect(confirmed.html).toContain("your booking is confirmed");
    expect(cancelled.subject).toContain("booking cancelled");
    expect(cancelled.html).toContain("unable to accommodate your booking");
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
