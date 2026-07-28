import { createConnection } from "node:net";
import { createInterface } from "node:readline";

export type SmtpMessage = {
  host: string;
  port: number;
  from: string;
  replyTo: string;
  to: string;
  subject: string;
  html: string;
  messageId: string;
};

type SmtpResponse = {
  code: number;
  text: string;
};

function smtpError(
  stage: string,
  response: SmtpResponse,
  code: string,
): Error {
  return Object.assign(
    new Error(`SMTP ${stage} rejected with ${response.code}`),
    {
      code,
      statusCode: response.code,
    },
  );
}

function assertHeader(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed || /[\r\n]/.test(trimmed)) {
    throw Object.assign(new Error(`Invalid SMTP ${name} header`), {
      code: "invalid_smtp_header",
      statusCode: 422,
    });
  }
  return trimmed;
}

function mailbox(value: string): string {
  const header = assertHeader(value, "from");
  const match = header.match(/<([^<>]+)>$/);
  return match?.[1]?.trim() || header;
}

function encodedSubject(value: string): string {
  const subject = assertHeader(value, "subject");
  return /^[\x20-\x7e]+$/.test(subject)
    ? subject
    : `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function dotStuff(value: string): string {
  return value
    .replace(/\r?\n/g, "\r\n")
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

function mimeMessage(input: SmtpMessage): string {
  const from = assertHeader(input.from, "from");
  const replyTo = assertHeader(input.replyTo, "reply-to");
  const to = assertHeader(input.to, "to");
  const messageId = assertHeader(input.messageId, "message-id");
  return [
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${messageId}@closure.yezyy.test>`,
    `From: ${from}`,
    `Reply-To: ${replyTo}`,
    `To: ${to}`,
    `Subject: ${encodedSubject(input.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    dotStuff(input.html),
  ].join("\r\n");
}

export async function sendSmtpMessage(input: SmtpMessage): Promise<void> {
  const socket = createConnection({ host: input.host, port: input.port });
  socket.setTimeout(5_000);
  const lines = createInterface({
    input: socket,
    crlfDelay: Infinity,
  })[Symbol.asyncIterator]();

  const socketFailure = new Promise<never>((_, reject) => {
    socket.once("error", (error) => {
      reject(
        Object.assign(new Error("SMTP connection failed"), {
          cause: error,
          code: "smtp_connection_error",
          statusCode: 503,
        }),
      );
    });
    socket.once("timeout", () => {
      reject(
        Object.assign(new Error("SMTP connection timed out"), {
          code: "smtp_connection_timeout",
          statusCode: 503,
        }),
      );
      socket.destroy();
    });
  });

  async function readResponse(): Promise<SmtpResponse> {
    let responseCode: number | null = null;
    const responseLines: string[] = [];
    while (true) {
      const next = await Promise.race([lines.next(), socketFailure]);
      if (next.done) {
        throw Object.assign(new Error("SMTP connection closed unexpectedly"), {
          code: "smtp_connection_closed",
          statusCode: 503,
        });
      }
      const match = next.value.match(/^(\d{3})([ -])(.*)$/);
      if (!match) continue;
      const code = Number(match[1]);
      responseCode ??= code;
      responseLines.push(match[3] ?? "");
      if (match[2] === " " && code === responseCode) {
        return { code, text: responseLines.join(" ") };
      }
    }
  }

  async function write(command: string): Promise<void> {
    if (socket.write(command)) return;
    await new Promise<void>((resolve) => socket.once("drain", resolve));
  }

  async function expectResponse(
    stage: string,
    accepted: readonly number[],
    code: string,
  ): Promise<SmtpResponse> {
    const response = await readResponse();
    if (!accepted.includes(response.code)) {
      throw smtpError(stage, response, code);
    }
    return response;
  }

  try {
    await expectResponse("greeting", [220], "smtp_greeting_rejected");
    await write("EHLO closure.yezyy.test\r\n");
    await expectResponse("EHLO", [250], "smtp_ehlo_rejected");
    await write(`MAIL FROM:<${mailbox(input.from)}>\r\n`);
    await expectResponse("sender", [250], "smtp_sender_rejected");
    await write(`RCPT TO:<${assertHeader(input.to, "to")}>\r\n`);
    await expectResponse("recipient", [250, 251], "smtp_recipient_rejected");
    await write("DATA\r\n");
    await expectResponse("DATA", [354], "smtp_data_rejected");
    await write(`${mimeMessage(input)}\r\n.\r\n`);
    await expectResponse("message", [250], "smtp_message_rejected");
    await write("QUIT\r\n");
  } finally {
    socket.end();
  }
}
