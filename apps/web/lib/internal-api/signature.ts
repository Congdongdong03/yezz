import { createHash, createHmac } from "node:crypto";
import { isIP } from "node:net";

const TRUSTED_PLATFORM_IP_HEADER = "x-vercel-forwarded-for";
const MINIMUM_SHARED_SECRET_LENGTH = 32;
const CLOSURE_SENTINEL_PATTERN = /^[a-f0-9]{64}$/;

export type InternalRequestSigningInput = {
  method: string;
  pathAndQuery: string;
  requestId: string;
  timestamp: number;
  clientIp: string;
  idempotencyKey?: string | null;
  body: Uint8Array;
};

export type SignedInternalHeaders = {
  "x-yezyy-client-ip": string;
  "x-yezyy-request-id": string;
  "x-yezyy-request-timestamp": string;
  "x-yezyy-body-sha256": string;
  "x-yezyy-signature": string;
};

export class InternalTransportError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "InternalTransportError";
  }
}

function normalizeIp(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return isIP(normalized) === 0 ? null : normalized;
}

function canonicalRequest(input: InternalRequestSigningInput, bodyDigest: string): string {
  return [
    input.method.toUpperCase(),
    input.pathAndQuery,
    input.requestId,
    String(input.timestamp),
    input.clientIp,
    input.idempotencyKey ?? "",
    bodyDigest,
  ].join("\n");
}

function assertStrongSharedSecret(secret: string): void {
  if (
    secret.length < MINIMUM_SHARED_SECRET_LENGTH ||
    Buffer.byteLength(secret, "utf8") < MINIMUM_SHARED_SECRET_LENGTH
  ) {
    throw new InternalTransportError(
      503,
      "WEAK_INTERNAL_SHARED_SECRET",
      "The internal shared secret must be at least 32 characters",
    );
  }
}

export function signInternalRequest(
  input: InternalRequestSigningInput,
  secret: string,
): SignedInternalHeaders {
  assertStrongSharedSecret(secret);
  const bodyDigest = createHash("sha256").update(input.body).digest("hex");
  const signature = createHmac("sha256", secret)
    .update(canonicalRequest(input, bodyDigest))
    .digest("hex");

  return {
    "x-yezyy-client-ip": input.clientIp,
    "x-yezyy-request-id": input.requestId,
    "x-yezyy-request-timestamp": String(input.timestamp),
    "x-yezyy-body-sha256": bodyDigest,
    "x-yezyy-signature": signature,
  };
}

export function readTrustedPlatformIp(
  headers: Pick<Headers, "get">,
  requireTrustedPlatform: boolean,
): string {
  const raw = headers.get(TRUSTED_PLATFORM_IP_HEADER);
  const normalized = raw && !raw.includes(",") ? normalizeIp(raw) : null;

  if (normalized) return normalized;
  if (!requireTrustedPlatform) return "127.0.0.1";

  throw new InternalTransportError(
    400,
    "TRUSTED_CLIENT_IP_REQUIRED",
    "A trusted client address is required",
  );
}

/**
 * Resolve the only client identity that may be placed into a signed internal
 * request. Generic proxy headers are intentionally not considered here.
 */
export function resolveTrustedClientIp(
  headers: Pick<Headers, "get">,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  if (environment.VERCEL === "1") {
    return readTrustedPlatformIp(headers, true);
  }
  const closureSentinel = environment.YEZYY_CLOSURE_RUN_SENTINEL?.trim() ?? "";
  if (
    environment.YEZYY_CLOSURE_E2E === "1" &&
    CLOSURE_SENTINEL_PATTERN.test(closureSentinel)
  ) {
    return "127.0.0.1";
  }
  if (environment.NODE_ENV === "production") {
    throw new InternalTransportError(
      503,
      "TRUSTED_PLATFORM_REQUIRED",
      "The trusted request platform is not available",
    );
  }
  return "127.0.0.1";
}

export function assertSameOrigin(origin: string | null, expectedOrigin: string): void {
  let actualOrigin: string;
  try {
    if (!origin) throw new Error("missing origin");
    actualOrigin = new URL(origin).origin;
  } catch {
    throw new InternalTransportError(403, "INVALID_ORIGIN", "Origin is not allowed");
  }

  if (actualOrigin !== expectedOrigin) {
    throw new InternalTransportError(403, "INVALID_ORIGIN", "Origin is not allowed");
  }
}
