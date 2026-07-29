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
        return { data: { id: "resend-message-123" }, error: null };
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

  it("uses Melbourne as the default store timezone", async () => {
    const originalStoreTimezone = process.env.STORE_TIMEZONE;
    delete process.env.STORE_TIMEZONE;
    vi.resetModules();
    const { getStoreTimezone } = await import("./email.js");

    expect(getStoreTimezone()).toBe("Australia/Melbourne");

    if (originalStoreTimezone === undefined) delete process.env.STORE_TIMEZONE;
    else process.env.STORE_TIMEZONE = originalStoreTimezone;
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
    expect(cancelled.subject).toMatch(/booking cancelled/i);
    expect(cancelled.html).toContain("booking has been cancelled");
  });

  it("returns the provider message ID for a typed outbox template", async () => {
    const { createResendOutboxProvider } = await import("./email.js");
    const provider = createResendOutboxProvider();

    await expect(
      provider.send({
        id: "00000000-0000-4000-8000-000000000001",
        dedupeKey: "booking:1:status:confirmed:customer",
        bookingId: "00000000-0000-4000-8000-000000000002",
        cartOrderId: null,
        statusEventId: "00000000-0000-4000-8000-000000000003",
        messageType: "booking_status_customer",
        recipient: "customer@example.com",
        locale: "en",
        payload: {
          template: "booking_status",
          status: "confirmed",
          customerName: "Wesley",
          orderNumber: "booking-20260728-1234",
          storeName: "YezYY",
          contact: { email: "congdongdong03@gmail.com" },
        },
      }),
    ).resolves.toEqual({ providerMessageId: "resend-message-123" });

    const sentEmail = sentEmails.at(-1) as {
      html: string;
      replyTo: string;
      subject: string;
    };
    expect(sentEmail.subject).toContain("booking confirmed");
    expect(sentEmail.html).toContain("your booking is confirmed");
    expect(sentEmail.replyTo).toBe("congdongdong03@gmail.com");
  });

  it("renders a queued booking acknowledgement with manual confirmation and pay-in-store copy", async () => {
    const { createResendOutboxProvider } = await import("./email.js");
    const provider = createResendOutboxProvider();

    await provider.send({
      id: "00000000-0000-4000-8000-000000000001",
      dedupeKey: "booking:1:received:customer",
      bookingId: "00000000-0000-4000-8000-000000000002",
      cartOrderId: null,
      statusEventId: null,
      messageType: "booking_received_customer",
      recipient: "customer@example.com",
      locale: "en",
      payload: {
        template: "booking_received",
        orderId: "00000000-0000-4000-8000-000000000002",
        orderNumber: "booking-20260728-1234",
        submittedAt: "2026-07-28T02:00:00.000Z",
        input: {
          name: "Wesley",
          phone: "0430787712",
          locale: "en",
        },
        contact: { email: "congdongdong03@gmail.com" },
      },
    });

    const sentEmail = sentEmails.at(-1) as { html: string; subject: string };
    expect(sentEmail.subject).toContain("Booking Request Received");
    expect(sentEmail.html).toContain("awaiting confirmation");
    expect(sentEmail.html).toContain("Pay in Store");
    expect(sentEmail.html).not.toContain("Your booking is confirmed");
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

describe("live booking notification templates", () => {
  beforeEach(() => {
    sentEmails.length = 0;
    vi.resetModules();
    process.env.NODE_ENV = "test";
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.EMAIL_FROM = "YezYY <bookings@yezyy.com>";
    process.env.EMAIL_REPLY_TO = "congdongdong03@gmail.com";
  });

  const common = {
    customerName: "Wesley",
    bookingNumber: "booking-20260729-1234",
    offeringLabel: "Melty Bead Craft",
    date: "2026-08-02",
    startTime: "13:00",
    endTime: "14:00",
    manageUrl:
      "https://yezyy.com/en/manage-booking/customer-token-1234567890",
    storeName: "YezYY",
    contactEmail: "congdongdong03@gmail.com",
    contactPhone: "0430 787 712",
  } as const;

  const cases = [
    {
      template: "booking_confirmed",
      en: /booking confirmed/i,
      zh: /预约已确认/,
    },
    {
      template: "booking_rejected",
      en: /unable to accept/i,
      zh: /无法接受/,
    },
    {
      template: "booking_waitlisted",
      en: /waitlist/i,
      zh: /候补/,
    },
    {
      template: "party_time_proposed",
      en: /proposed party time/i,
      zh: /建议的派对时间/,
      extra: { paymentDeadline: "2026-07-31T02:00:00.000Z" },
    },
    {
      template: "party_payment_due",
      en: /venue fee.*due/i,
      zh: /场地费.*待支付/,
      extra: {
        paymentDeadline: "2026-07-31T02:00:00.000Z",
        amountCents: 9500,
      },
    },
    {
      template: "party_payment_recorded",
      en: /payment recorded/i,
      zh: /付款已记录/,
      extra: { amountCents: 9500 },
    },
    {
      template: "party_payment_expired",
      en: /payment deadline.*expired/i,
      zh: /付款期限已过/,
      extra: { amountCents: 9500 },
    },
    {
      template: "cancellation_request",
      en: /cancellation request.*received/i,
      zh: /取消申请已收到/,
    },
    {
      template: "reschedule_request",
      en: /reschedule request.*received/i,
      zh: /改期申请已收到/,
    },
    {
      template: "booking_reminder",
      en: /booking reminder/i,
      zh: /预约提醒/,
    },
  ] as const;

  it.each(cases)("renders $template safely in English and Chinese", async (testCase) => {
    const { renderEmail } = await import("./email.js");
    for (const locale of ["en", "zh"] as const) {
      const html = renderEmail({
        locale,
        payload: {
          template: testCase.template,
          ...common,
          ...("extra" in testCase ? testCase.extra : {}),
        },
      });
      expect(html).toMatch(locale === "zh" ? testCase.zh : testCase.en);
      expect(html).toContain("YezYY");
      expect(html).toContain("congdongdong03@gmail.com");
      expect(html).toContain("0430 787 712");
      expect(html).toContain("manage-booking");
    }
  });

  it.each(["en", "zh"] as const)(
    "never calls a pending booking request confirmed in %s",
    async (locale) => {
      const { renderEmail } = await import("./email.js");
      const html = renderEmail({
        locale,
        payload: {
          template: "booking_received",
          orderId: "00000000-0000-4000-8000-000000000002",
          orderNumber: common.bookingNumber,
          submittedAt: "2026-07-29T02:00:00.000Z",
          input: {
            name: common.customerName,
            phone: "0430787712",
            locale,
          },
          contact: {
            email: common.contactEmail,
            phone: common.contactPhone,
          },
        },
      });
      expect(html).not.toMatch(
        locale === "zh" ? /预约已确认/ : /booking confirmed/i,
      );
      expect(html).toMatch(
        locale === "zh" ? /等待人工确认/ : /awaiting.*confirmation/i,
      );
    },
  );

  it.each([
    "party_time_proposed",
    "party_payment_due",
    "party_payment_recorded",
  ] as const)(
    "keeps %s strictly in-store and staff-recorded",
    async (template) => {
      const { renderEmail } = await import("./email.js");
      const html = renderEmail({
        locale: "en",
        payload: {
          template,
          ...common,
          amountCents: 9500,
          paymentDeadline: "2026-07-31T02:00:00.000Z",
        },
      });
      expect(html).toMatch(/paid in store/i);
      expect(html).toMatch(/staff.*record/i);
      expect(html).not.toMatch(/pay online|online checkout|payment link/i);
    },
  );

  it("escapes every customer and staff free-text field and URL attribute", async () => {
    const { renderEmail } = await import("./email.js");
    const injection = `<img src=x onerror="alert(1)">`;
    const html = renderEmail({
      locale: "en",
      payload: {
        template: "staff_notification",
        ...common,
        customerName: injection,
        offeringLabel: injection,
        note: injection,
        customerEmail: "customer@example.com",
        customerPhone: injection,
        manageUrl: `https://yezyy.com/manage-booking/x" onmouseover="alert(2)`,
      },
    });
    expect(html).not.toContain(injection);
    expect(html).not.toContain('onmouseover="alert(2)"');
    expect(html).toContain("&lt;img");
    expect(html).toContain("&quot; onmouseover=&quot;");
  });

  it.each([
    ["storeName", "YEZZ"],
    ["contactEmail", "attacker@example.com"],
    ["contactPhone", "0000 000 000"],
    ["amountCents", 1234],
    ["manageUrl", "javascript:alert(1)"],
  ] as const)("rejects an invalid typed %s before provider send", async (field, value) => {
    const { createResendOutboxProvider } = await import("./email.js");
    const provider = createResendOutboxProvider();

    await expect(
      provider.send({
        id: "00000000-0000-4000-8000-000000000001",
        dedupeKey: `booking:1:notification:${field}`,
        bookingId: "00000000-0000-4000-8000-000000000002",
        cartOrderId: null,
        statusEventId: null,
        messageType: "booking_notification_customer",
        recipient: "customer@example.com",
        locale: "en",
        payload: {
          template: "party_payment_due",
          ...common,
          paymentDeadline: "2026-07-31T02:00:00.000Z",
          amountCents: 9500,
          [field]: value,
        },
      }),
    ).rejects.toMatchObject({ code: "INVALID_EMAIL_PAYLOAD" });
  });

  it("validates typed payloads before direct rendering", async () => {
    const { renderEmail } = await import("./email.js");
    expect(() =>
      renderEmail({
        locale: "en",
        payload: {
          template: "booking_reminder",
          ...common,
          manageUrl: "javascript:alert(1)",
        },
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_EMAIL_PAYLOAD" }));
  });

  it.each([
    {
      status: "pending_review",
      en: /awaiting manual confirmation/i,
      zh: /等待人工确认/,
    },
    { status: "waitlisted", en: /waitlist/i, zh: /候补/ },
    { status: "rejected", en: /unable to accept/i, zh: /无法接受/ },
    {
      status: "reschedule_requested",
      en: /reschedule request.*review/i,
      zh: /改期申请.*审核/,
    },
    {
      status: "cancellation_requested",
      en: /cancellation request.*review/i,
      zh: /取消申请.*审核/,
    },
    { status: "cancelled", en: /booking cancelled/i, zh: /预约已取消/ },
  ] as const)(
    "keeps legacy status outbox rendering truthful for $status",
    async ({ status, en, zh }) => {
      const { createResendOutboxProvider } = await import("./email.js");
      const provider = createResendOutboxProvider();
      for (const locale of ["en", "zh"] as const) {
        await provider.send({
          id: "00000000-0000-4000-8000-000000000001",
          dedupeKey: `booking:1:status:${status}:${locale}`,
          bookingId: "00000000-0000-4000-8000-000000000002",
          cartOrderId: null,
          statusEventId: "00000000-0000-4000-8000-000000000003",
          messageType: "booking_status_customer",
          recipient: "customer@example.com",
          locale,
          payload: {
            template: "booking_status",
            status,
            locale,
            customerName: "Wesley",
            orderNumber: common.bookingNumber,
            storeName: "YezYY",
            contact: {
              email: common.contactEmail,
              phone: common.contactPhone,
            },
          },
        });
        const email = sentEmails.at(-1) as { subject: string; html: string };
        const combined = `${email.subject}\n${email.html}`;
        expect(combined).toMatch(locale === "zh" ? zh : en);
        if (status === "pending_review") {
          expect(combined).not.toMatch(
            locale === "zh" ? /预约已确认/ : /booking confirmed/i,
          );
        }
      }
    },
  );
});
