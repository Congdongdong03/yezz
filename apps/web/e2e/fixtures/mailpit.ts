type MailpitAddress = {
  Address?: string;
  Email?: string;
  Name?: string;
};

export type MailpitMessage = {
  ID: string;
  Subject: string;
  To: MailpitAddress[];
};

type MailpitSearch = {
  messages?: MailpitMessage[];
  Messages?: MailpitMessage[];
};

function mailpitUrl(path: string): string {
  const base = process.env.MAILPIT_API_URL?.trim();
  if (!base) {
    throw new Error("Closure E2E requires the isolated local Mailpit API");
  }
  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error("Closure E2E requires the isolated local Mailpit API");
  }
  if (
    parsed.protocol !== "http:" ||
    parsed.hostname !== "127.0.0.1" ||
    !/^\d+$/.test(parsed.port) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/"
  ) {
    throw new Error("Closure E2E requires the isolated local Mailpit API");
  }
  return `${parsed.origin}${path}`;
}

async function mailpitRequest(path: string, init?: RequestInit) {
  const response = await fetch(mailpitUrl(path), init);
  if (!response.ok) {
    throw new Error(`Mailpit ${path} returned ${response.status}`);
  }
  return response;
}

export async function findMailpitMessages(
  recipient: string,
): Promise<MailpitMessage[]> {
  const query = encodeURIComponent(`to:"${recipient}"`);
  const response = await mailpitRequest(
    `/api/v1/search?query=${query}&limit=100`,
  );
  const data = (await response.json()) as MailpitSearch;
  return data.messages ?? data.Messages ?? [];
}

export async function waitForMailpitMessage(options: {
  recipient: string;
  subjectIncludes: string;
  timeoutMilliseconds?: number;
}): Promise<MailpitMessage> {
  const deadline =
    Date.now() + (options.timeoutMilliseconds ?? 10_000);
  while (Date.now() < deadline) {
    const match = (await findMailpitMessages(options.recipient)).find(
      (message) => message.Subject.includes(options.subjectIncludes),
    );
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Timed out waiting for Mailpit message to ${options.recipient}`,
  );
}

export async function deleteMailpitMessagesFor(
  recipients: string[],
): Promise<void> {
  const ids = new Set<string>();
  for (const recipient of recipients) {
    for (const message of await findMailpitMessages(recipient)) {
      ids.add(message.ID);
    }
  }
  if (ids.size === 0) return;
  await mailpitRequest("/api/v1/messages", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ IDs: [...ids] }),
  });
}

export async function setMailpitRecipientFailure(
  enabled: boolean,
): Promise<void> {
  const response = await mailpitRequest("/api/v1/chaos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      enabled
        ? {
            Recipient: {
              ErrorCode: 550,
              Probability: 100,
            },
          }
        : {},
    ),
  });
  const configured = (await response.json()) as {
    Recipient?: { ErrorCode?: number; Probability?: number };
  };
  if (
    enabled &&
    (configured.Recipient?.ErrorCode !== 550 ||
      configured.Recipient?.Probability !== 100)
  ) {
    throw new Error("Mailpit did not enable deterministic recipient failure");
  }
  if (!enabled && configured.Recipient?.Probability !== 0) {
    throw new Error("Mailpit did not disable recipient failure");
  }
}
