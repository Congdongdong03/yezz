import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { Readable } from "node:stream";
import type { FastifyInstance } from "fastify";
import { AppError } from "./errors.js";
import {
  isCustomerBookingRequestPath,
  safeRequestUrl,
} from "./request-log-redaction.js";

const SIGNATURE_MAX_AGE_SECONDS = 300;
const MINIMUM_SHARED_SECRET_LENGTH = 32;
const HEX_SHA256 = /^[a-f0-9]{64}$/;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type HeaderSource =
  | Pick<Headers, "get">
  | Record<string, string | string[] | undefined>;

export type InternalRequestLike = {
  method: string;
  url: string;
  headers: HeaderSource;
};

export type InternalRequestVerificationOptions = {
  secrets: string | readonly string[];
  now?: number;
  maxAgeSeconds?: number;
};

export type VerifiedClientIdentity = {
  clientIp: string;
  requestId: string;
  timestamp: number;
  idempotencyKey: string | null;
};

declare module "fastify" {
  interface FastifyRequest {
    verifiedClientIdentity: VerifiedClientIdentity | null;
  }
}

export class InternalRequestError extends AppError {
  constructor(code: string, message: string) {
    super(401, code, message);
    this.name = "InternalRequestError";
  }
}

export type InternalRequestEnforcement = "log" | "require";

export type InternalRequestProtectionOptions = {
  enforcement: InternalRequestEnforcement;
  secrets?: string | readonly string[];
  now?: () => number;
  maxBodyBytes?: number;
};

const DEFAULT_MAX_SIGNED_BODY_BYTES = 6 * 1024 * 1024;

function protectedPath(method: string, url: string): boolean {
  const path = url.split("?", 1)[0]?.replace(/\/+$/, "") || "/";
  const normalizedMethod = method.toUpperCase();
  const customerBookingPath = isCustomerBookingRequestPath(url);
  return (
    (normalizedMethod === "POST" &&
      [
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
        "/api/v1/auth/setup-password",
      ].includes(path)) ||
    path === "/api/v1/admin" ||
    path.startsWith("/api/v1/admin/") ||
    (path === "/api/v1/cart" &&
      ["GET", "PUT"].includes(normalizedMethod)) ||
    (customerBookingPath &&
      ["GET", "POST"].includes(normalizedMethod)) ||
    (normalizedMethod === "POST" &&
      ["/api/v1/bookings", "/api/v1/cart-orders"].includes(path))
  );
}

function assertStrongSecret(secret: string): void {
  if (
    secret.length < MINIMUM_SHARED_SECRET_LENGTH ||
    Buffer.byteLength(secret, "utf8") < MINIMUM_SHARED_SECRET_LENGTH
  ) {
    throw new Error(
      "Every internal shared secret must be at least 32 characters",
    );
  }
}

function validateSecretList(secrets: readonly string[]): string[] {
  for (const secret of secrets) assertStrongSecret(secret);
  if (new Set(secrets).size !== secrets.length) {
    throw new Error("Current and previous internal shared secrets must be different");
  }
  return [...secrets];
}

export function resolveInternalRequestSecrets(
  current: string | undefined,
  previous: string | undefined,
): string[] {
  const currentSecret = current?.trim() || undefined;
  const previousSecret = previous?.trim() || undefined;
  if (previousSecret && !currentSecret) {
    throw new Error(
      "A current internal shared secret is required when a previous secret is configured",
    );
  }
  return validateSecretList(
    [currentSecret, previousSecret].filter(
      (secret): secret is string => secret !== undefined,
    ),
  );
}

async function readSignedBody(payload: Readable, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of payload) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.length;
    if (total > limit) {
      throw new AppError(
        413,
        "PAYLOAD_TOO_LARGE",
        "The signed request body is too large",
      );
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, total);
}

function replayBody(body: Buffer): Readable & { receivedEncodedLength?: number } {
  const replay = Readable.from([body]) as Readable & {
    receivedEncodedLength?: number;
  };
  replay.receivedEncodedLength = body.length;
  return replay;
}

function safeRequestId(headers: HeaderSource): string | null {
  const requestId = getHeader(headers, "x-yezyy-request-id");
  return requestId && UUID_V4.test(requestId) ? requestId : null;
}

export function registerInternalRequestProtection(
  app: FastifyInstance,
  options: InternalRequestProtectionOptions,
): void {
  const configuredSecrets =
    typeof options.secrets === "string"
      ? [options.secrets]
      : [...(options.secrets ?? [])];
  validateSecretList(configuredSecrets);
  if (
    options.enforcement === "require" &&
    (configuredSecrets.length === 0 ||
      configuredSecrets.some((secret) => secret.length === 0))
  ) {
    throw new Error(
      "WEB_API_SHARED_SECRET is required when internal request enforcement is enabled",
    );
  }

  app.decorateRequest("verifiedClientIdentity", null);
  app.addHook("preParsing", async (request, _reply, payload) => {
    if (!protectedPath(request.method, request.url)) return payload;

    const body = await readSignedBody(
      payload,
      options.maxBodyBytes ?? DEFAULT_MAX_SIGNED_BODY_BYTES,
    );
    const replay = replayBody(body);
    const path = safeRequestUrl(request.url);

    try {
      if (configuredSecrets.length === 0) {
        throw new InternalRequestError(
          "INTERNAL_SHARED_SECRET_MISSING",
          "The internal shared secret is missing",
        );
      }
      const identity = verifyInternalRequest(request, body, {
        secrets: configuredSecrets,
        now: options.now?.(),
      });
      request.verifiedClientIdentity = identity;
      request.log.info(
        { requestId: identity.requestId, path, result: "verified" },
        "Internal request verification",
      );
    } catch (error) {
      const result =
        error instanceof InternalRequestError ? error.code : "VERIFICATION_ERROR";
      request.log.info(
        { requestId: safeRequestId(request.headers), path, result },
        "Internal request verification",
      );
      if (options.enforcement === "require") throw error;
    }

    return replay;
  });
}

function getHeader(headers: HeaderSource, name: string): string | null {
  const possibleGetter = (headers as Pick<Headers, "get">).get;
  if (typeof possibleGetter === "function") {
    return possibleGetter.call(headers, name);
  }

  const record = headers as Record<string, string | string[] | undefined>;
  const value = record[name] ?? record[name.toLowerCase()];
  if (Array.isArray(value)) return value.length === 1 ? value[0] ?? null : null;
  return value ?? null;
}

function normalizeIp(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return isIP(normalized) === 0 ? null : normalized;
}

function constantTimeHexEqual(supplied: string, expected: string): boolean {
  const suppliedBytes = HEX_SHA256.test(supplied)
    ? Buffer.from(supplied, "hex")
    : Buffer.alloc(32);
  const expectedBytes = Buffer.from(expected, "hex");
  const equal = timingSafeEqual(suppliedBytes, expectedBytes);
  return HEX_SHA256.test(supplied) && equal;
}

function invalidSignature(): never {
  throw new InternalRequestError(
    "INVALID_INTERNAL_SIGNATURE",
    "The internal request signature is invalid",
  );
}

export function verifyInternalRequest(
  request: InternalRequestLike,
  rawBody: Uint8Array,
  options: InternalRequestVerificationOptions,
): VerifiedClientIdentity {
  const requestId = getHeader(request.headers, "x-yezyy-request-id") ?? "";
  const timestampText =
    getHeader(request.headers, "x-yezyy-request-timestamp") ?? "";
  const clientIpText = getHeader(request.headers, "x-yezyy-client-ip") ?? "";
  const suppliedBodyDigest =
    getHeader(request.headers, "x-yezyy-body-sha256") ?? "";
  const suppliedSignature =
    getHeader(request.headers, "x-yezyy-signature") ?? "";
  const idempotencyKey = getHeader(request.headers, "idempotency-key") ?? "";
  const clientIp = normalizeIp(clientIpText);

  if (
    !UUID_V4.test(requestId) ||
    !/^\d{10}$/.test(timestampText) ||
    !clientIp ||
    (idempotencyKey !== "" && !UUID_V4.test(idempotencyKey))
  ) {
    invalidSignature();
  }

  const bodyDigest = createHash("sha256").update(rawBody).digest("hex");
  if (!constantTimeHexEqual(suppliedBodyDigest, bodyDigest)) {
    invalidSignature();
  }

  const canonical = [
    request.method.toUpperCase(),
    request.url,
    requestId,
    timestampText,
    clientIp,
    idempotencyKey,
    bodyDigest,
  ].join("\n");
  const secrets =
    typeof options.secrets === "string" ? [options.secrets] : [...options.secrets];
  validateSecretList(secrets);
  if (secrets.length === 0 || secrets.some((secret) => secret.length === 0)) {
    invalidSignature();
  }

  let signatureMatches = false;
  for (const secret of secrets) {
    const expected = createHmac("sha256", secret).update(canonical).digest("hex");
    signatureMatches =
      constantTimeHexEqual(suppliedSignature, expected) || signatureMatches;
  }
  if (!signatureMatches) {
    invalidSignature();
  }

  const timestamp = Number(timestampText);
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > (options.maxAgeSeconds ?? SIGNATURE_MAX_AGE_SECONDS)) {
    throw new InternalRequestError(
      "EXPIRED_INTERNAL_SIGNATURE",
      "The internal request signature has expired",
    );
  }

  return {
    clientIp,
    requestId,
    timestamp,
    idempotencyKey: idempotencyKey || null,
  };
}
