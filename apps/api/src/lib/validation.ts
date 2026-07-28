import type { CartOrderCreateInput } from "../repositories/cart-orders.repository.js";
import { AppError } from "./errors.js";

const CART_ORDER_INPUT_LIMITS = {
  name: 255,
  phone: 64,
  wechat: 128,
  email: 255,
  message: 5000,
  items: 50,
  projectId: 36,
  projectName: 255,
  projectType: 10,
  styleName: 255,
  date: 32,
  people: 1000,
  price: 32,
} as const;

function assertMaxLength(value: unknown, field: string, maxLength: number): void {
  if (value == null) return;
  if (typeof value !== "string") {
    throw new AppError(400, "VALIDATION_ERROR", `${field} must be a string`);
  }
  if (value.length > maxLength) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${field} must be at most ${maxLength} characters`,
    );
  }
}

function assertLocalizedStringMaxLength(value: unknown, field: string, maxLength: number): void {
  if (value == null || typeof value === "string") {
    assertMaxLength(value, field, maxLength);
    return;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} must be a string or localized string`);
  }

  const localized = value as Record<string, unknown>;
  if (Object.keys(localized).some((key) => key !== "en" && key !== "zh")) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} must be a localized string`);
  }
  assertMaxLength(localized.en, `${field}.en`, maxLength);
  assertMaxLength(localized.zh, `${field}.zh`, maxLength);
}

function assertMaxNumber(value: unknown, field: string, maxValue: number): void {
  if (value == null) return;
  if (typeof value !== "number" || !Number.isFinite(value) || value > maxValue) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} must be at most ${maxValue}`);
  }
}

export function validateCartOrderInputLengths(input: CartOrderCreateInput): void {
  assertMaxLength(input.name, "name", CART_ORDER_INPUT_LIMITS.name);
  assertMaxLength(input.phone, "phone", CART_ORDER_INPUT_LIMITS.phone);
  assertMaxLength(input.wechat, "wechat", CART_ORDER_INPUT_LIMITS.wechat);
  assertMaxLength(input.email, "email", CART_ORDER_INPUT_LIMITS.email);
  assertMaxLength(input.message, "message", CART_ORDER_INPUT_LIMITS.message);

  if (input.items.length > CART_ORDER_INPUT_LIMITS.items) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `items must contain at most ${CART_ORDER_INPUT_LIMITS.items} entries`,
    );
  }

  for (const item of input.items) {
    assertMaxLength(item.projectId, "item projectId", CART_ORDER_INPUT_LIMITS.projectId);
    assertMaxLength(item.styleId, "item styleId", CART_ORDER_INPUT_LIMITS.projectId);
    assertLocalizedStringMaxLength(
      item.projectName,
      "item projectName",
      CART_ORDER_INPUT_LIMITS.projectName,
    );
    assertMaxLength(item.projectType, "item projectType", CART_ORDER_INPUT_LIMITS.projectType);
    assertLocalizedStringMaxLength(
      item.styleName,
      "item styleName",
      CART_ORDER_INPUT_LIMITS.styleName,
    );
    assertMaxLength(item.date, "item date", CART_ORDER_INPUT_LIMITS.date);
    assertMaxNumber(item.people, "item people", CART_ORDER_INPUT_LIMITS.people);
    assertMaxLength(item.price, "item price", CART_ORDER_INPUT_LIMITS.price);
  }
}

/**
 * Safely parse a value into a positive integer.
 * Returns fallback if value is not a number, NaN, or <= 0.
 */
export function parsePositiveInt(value: unknown, fallback: number, max?: number): number {
  const num = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(num) || !Number.isInteger(num) || num <= 0) {
    return fallback;
  }
  if (max !== undefined && num > max) {
    return max;
  }
  return num;
}
