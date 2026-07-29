import { createServer, type Server, type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createConfiguredOutboxProvider } from "./email.js";

const queuedMessage = {
  id: "00000000-0000-4000-8000-000000000001",
  dedupeKey: "booking:closure:status:confirmed:customer",
  bookingId: "00000000-0000-4000-8000-000000000002",
  cartOrderId: null,
  statusEventId: "00000000-0000-4000-8000-000000000003",
  messageType: "booking_status_customer",
  recipient: "customer@closure.test",
  locale: "en",
  payload: {
    template: "booking_status",
    status: "confirmed",
    customerName: "Closure Customer",
    orderNumber: "booking-closure-0001",
    storeName: "YezYY",
    contact: {
      email: "congdongdong03@gmail.com",
      phone: "0430 787 712",
    },
  },
} as const;

type FakeSmtp = {
  server: Server;
  port: number;
  messages: string[];
};

const servers: Server[] = [];

async function startSmtpServer(recipientCode = 250): Promise<FakeSmtp> {
  const messages: string[] = [];
  const server = createServer((socket: Socket) => {
    let buffer = "";
    let receivingData = false;
    socket.write("220 closure.test ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (receivingData) {
        const end = buffer.indexOf("\r\n.\r\n");
        if (end === -1) return;
        messages.push(buffer.slice(0, end));
        buffer = buffer.slice(end + 5);
        receivingData = false;
        socket.write("250 2.0.0 captured\r\n");
      }
      while (!receivingData) {
        const end = buffer.indexOf("\r\n");
        if (end === -1) return;
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (line.startsWith("EHLO ")) socket.write("250 closure.test\r\n");
        else if (line.startsWith("MAIL FROM:")) socket.write("250 sender ok\r\n");
        else if (line.startsWith("RCPT TO:")) {
          socket.write(`${recipientCode} recipient response\r\n`);
        } else if (line === "DATA") {
          receivingData = true;
          socket.write("354 end with dot\r\n");
          return;
        } else if (line === "QUIT") {
          socket.end("221 bye\r\n");
          return;
        }
      }
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", resolve),
  );
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("SMTP test server did not bind a TCP port");
  }
  return { server, port: address.port, messages };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        ),
    ),
  );
});

function smtpEnvironment(port: number) {
  return {
    NODE_ENV: "test",
    EMAIL_PROVIDER: "smtp",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(port),
    EMAIL_FROM: "YezYY Closure <closure@closure.test>",
    EMAIL_REPLY_TO: "contact@closure.test",
  };
}

describe("test-only SMTP outbox provider", () => {
  it("renders and sends the real queued customer message over SMTP", async () => {
    const smtp = await startSmtpServer();
    const provider = createConfiguredOutboxProvider(
      smtpEnvironment(smtp.port),
    );

    await expect(provider.send(queuedMessage)).resolves.toEqual({
      providerMessageId:
        "smtp:booking:closure:status:confirmed:customer",
    });
    expect(smtp.messages).toHaveLength(1);
    expect(smtp.messages[0]).toContain("To: customer@closure.test");
    expect(smtp.messages[0]).toContain("booking confirmed");
    expect(smtp.messages[0]).toContain("your booking is confirmed");
  });

  it("surfaces a permanent recipient rejection to the outbox worker", async () => {
    const smtp = await startSmtpServer(550);
    const provider = createConfiguredOutboxProvider(
      smtpEnvironment(smtp.port),
    );

    await expect(provider.send(queuedMessage)).rejects.toMatchObject({
      statusCode: 550,
      code: "smtp_recipient_rejected",
    });
  });

  it("refuses the local SMTP provider outside the test environment", () => {
    expect(() =>
      createConfiguredOutboxProvider({
        ...smtpEnvironment(1025),
        NODE_ENV: "production",
      }),
    ).toThrow("test environment");
  });
});
