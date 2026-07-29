import { randomUUID } from "node:crypto";
import {
  assertSameOrigin,
  InternalTransportError,
  resolveTrustedClientIp,
  signInternalRequest,
} from "@/lib/internal-api/signature";
import { validateCustomerRescheduleRequest } from "@/lib/booking/customer-reschedule-policy";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const REQUEST_HEADER_ALLOWLIST = [
  "accept",
  "accept-language",
  "content-type",
  "cookie",
  "idempotency-key",
] as const;

const RESPONSE_HEADER_ALLOWLIST = [
  "cache-control",
  "content-disposition",
  "content-language",
  "content-type",
  "etag",
  "last-modified",
  "location",
  "retry-after",
  "vary",
] as const;

function isUnsafeMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function getCanonicalSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (
    process.env.NODE_ENV === "production" &&
    process.env.YEZYY_CLOSURE_E2E === "1" &&
    configured
  ) {
    const closureSite = new URL(configured);
    if (
      closureSite.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(closureSite.hostname)
    ) {
      return closureSite.origin;
    }
  }
  if (process.env.NODE_ENV === "production") return "https://yezyy.com";
  return configured ? new URL(configured).origin : "http://localhost:3000";
}

function getApiOrigin(): string {
  const configured =
    process.env.API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  const origin = new URL(configured || "http://localhost:4000");
  if (!["http:", "https:"].includes(origin.protocol)) {
    throw new InternalTransportError(
      503,
      "INTERNAL_API_MISCONFIGURED",
      "The internal API is not configured",
    );
  }
  origin.pathname = origin.pathname.replace(/\/+$/, "");
  origin.search = "";
  origin.hash = "";
  return origin.toString().replace(/\/$/, "");
}

function resolveApiPath(path: string[]): string {
  if (
    path.length < 2 ||
    path[0] !== "v1" ||
    path.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("/") ||
        segment.includes("\\") ||
        !/^[a-zA-Z0-9_-]+$/.test(segment),
    )
  ) {
    throw new InternalTransportError(404, "NOT_FOUND", "Route not found");
  }
  return `/api/${path.join("/")}`;
}

function assertAllowedTarget(method: string, apiPath: string): void {
  const normalizedMethod = method.toUpperCase();
  const adminRoute =
    apiPath === "/api/v1/admin" || apiPath.startsWith("/api/v1/admin/");
  const customerBookingRead =
    normalizedMethod === "GET" &&
    /^\/api\/v1\/customer-bookings\/[A-Za-z0-9_-]{43}$/.test(apiPath);
  const customerBookingAction =
    normalizedMethod === "POST" &&
    /^\/api\/v1\/customer-bookings\/[A-Za-z0-9_-]{43}\/(?:accept-time|request-cancellation|request-reschedule)$/.test(
      apiPath,
    );
  const allowed =
    (normalizedMethod === "POST" &&
      [
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
        "/api/v1/auth/setup-password",
      ].includes(apiPath)) ||
    (normalizedMethod === "POST" &&
      ["/api/v1/bookings", "/api/v1/cart-orders"].includes(apiPath)) ||
    (apiPath === "/api/v1/cart" &&
      ["GET", "PUT"].includes(normalizedMethod)) ||
    customerBookingRead ||
    customerBookingAction ||
    (adminRoute &&
      ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes(
        normalizedMethod,
      ));

  if (!allowed) {
    throw new InternalTransportError(404, "NOT_FOUND", "Route not found");
  }
}

function assertValidCustomerReschedule(
  method: string,
  apiPath: string,
  body: Uint8Array,
): void {
  if (
    method !== "POST" ||
    !/^\/api\/v1\/customer-bookings\/[A-Za-z0-9_-]{43}\/request-reschedule$/.test(
      apiPath,
    )
  ) {
    return;
  }

  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder().decode(body));
  } catch {
    input = null;
  }
  const candidate =
    input !== null &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    Object.getPrototypeOf(input) === Object.prototype
      ? (input as Record<string, unknown>)
      : null;
  const keys = candidate ? Object.keys(candidate) : [];
  if (
    !candidate ||
    keys.length !== 2 ||
    !keys.includes("date") ||
    !keys.includes("startTime") ||
    typeof candidate.date !== "string" ||
    typeof candidate.startTime !== "string" ||
    !validateCustomerRescheduleRequest({
      date: candidate.date,
      startTime: candidate.startTime,
    }).valid
  ) {
    throw new InternalTransportError(
      400,
      "VALIDATION_ERROR",
      "The requested reschedule time is not available",
    );
  }
}

function sanitizeSetCookie(cookie: string): string {
  const attributes = cookie
    .split(";")
    .map((part) => part.trim())
    .filter((part) => !/^domain=/i.test(part) && !/^samesite=/i.test(part));
  attributes.push("SameSite=Lax");
  return attributes.join("; ");
}

function errorResponse(error: unknown): Response {
  if (error instanceof InternalTransportError) {
    return Response.json(
      {
        success: false,
        error: { code: error.code, message: error.message },
      },
      { status: error.status },
    );
  }

  return Response.json(
    {
      success: false,
      error: {
        code: "INTERNAL_TRANSPORT_ERROR",
        message: "The backend request could not be completed",
      },
    },
    { status: 502 },
  );
}

async function handleBackendRequest(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    const method = request.method.toUpperCase();
    const { path } = await context.params;
    const apiPath = resolveApiPath(path);
    assertAllowedTarget(method, apiPath);

    if (isUnsafeMethod(method)) {
      assertSameOrigin(request.headers.get("origin"), getCanonicalSiteOrigin());
    }

    const clientIp = resolveTrustedClientIp(request.headers);
    const secret = process.env.WEB_API_SHARED_SECRET?.trim();
    if (!secret) {
      throw new InternalTransportError(
        503,
        "INTERNAL_TRANSPORT_MISCONFIGURED",
        "The backend transport is not configured",
      );
    }

    const body = new Uint8Array(await request.arrayBuffer());
    assertValidCustomerReschedule(method, apiPath, body);
    const url = new URL(request.url);
    const pathAndQuery = `${apiPath}${url.search}`;
    const idempotencyKey = request.headers.get("idempotency-key");
    const signed = signInternalRequest(
      {
        method,
        pathAndQuery,
        requestId: randomUUID(),
        timestamp: Math.floor(Date.now() / 1000),
        clientIp,
        idempotencyKey,
        body,
      },
      secret,
    );

    const headers = new Headers();
    for (const name of REQUEST_HEADER_ALLOWLIST) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    for (const [name, value] of Object.entries(signed)) {
      headers.set(name, value);
    }

    const upstream = await fetch(`${getApiOrigin()}${pathAndQuery}`, {
      method,
      headers,
      body: ["GET", "HEAD"].includes(method) ? undefined : body,
      cache: "no-store",
      credentials: "omit",
      redirect: "manual",
      signal: request.signal,
    });

    const responseHeaders = new Headers();
    for (const name of RESPONSE_HEADER_ALLOWLIST) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) {
      responseHeaders.append("set-cookie", sanitizeSetCookie(cookie));
    }

    const responseBody =
      method === "HEAD" || upstream.status === 204
        ? null
        : await upstream.arrayBuffer();
    return new Response(responseBody, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export const GET = handleBackendRequest;
export const HEAD = handleBackendRequest;
export const POST = handleBackendRequest;
export const PUT = handleBackendRequest;
export const PATCH = handleBackendRequest;
export const DELETE = handleBackendRequest;
