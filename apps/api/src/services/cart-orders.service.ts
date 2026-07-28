import type { CartOrderItemSnapshot, Db } from "@yezz/db";
import { AppError } from "../lib/errors.js";
import {
  displayLocalized,
  formatCartOrderId,
  type StoreContact,
} from "../lib/email.js";
import { requireIdempotencyKey } from "../lib/public-create-idempotency.js";
import { validateCartOrderInputLengths } from "../lib/validation.js";
import {
  createCartOrdersRepository,
  type CartOrderCreateInput,
} from "../repositories/cart-orders.repository.js";
import { createEmailOutboxRepository } from "../repositories/email-outbox.repository.js";
import { createProjectsRepository } from "../repositories/projects.repository.js";
import { createRequestCapacityRepository } from "../repositories/request-capacity.repository.js";
import { createSettingsRepository } from "../repositories/settings.repository.js";
import {
  readRequestCapabilities,
  type RequestCapabilities,
} from "./settings.service.js";

export type CartOrderDto = {
  id: string;
  status: string;
  createdAt: Date;
  replayed: boolean;
  notification: "queued";
};

export type CartOrdersService = ReturnType<typeof createCartOrdersService>;

type CanonicalCartInput = {
  name: string;
  phone: string;
  wechat: string | null;
  email: string;
  message: string | null;
  timeSlotId: string;
  numberOfPeople: number;
  preferredDate: string | null;
  locale: "en" | "zh";
  items: Array<{ projectId: string; styleId: string | null }>;
};

type PersistedCartReplayIdentity = {
  name: string;
  phone: string;
  wechat: string | null;
  email: string | null;
  message: string | null;
  timeSlotId: string | null;
  numberOfPeople: number | null;
  preferredDate: string | null;
  locale: string | null;
};

type PersistedCartItemReplayIdentity = {
  projectId: string | null;
  styleId: string | null;
};

function normalizedOptionalText(
  value: string | null | undefined,
): string | null {
  return value?.trim() || null;
}

function assertUuid(value: string | null | undefined, field: string): string {
  if (
    !value ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new AppError(400, "VALIDATION_ERROR", `${field} must be a UUID`);
  }
  return value.toLowerCase();
}

function validateCartOrderInput(input: CartOrderCreateInput): void {
  if (!input.name?.trim()) {
    throw new AppError(400, "VALIDATION_ERROR", "name is required");
  }
  if (!input.phone?.trim()) {
    throw new AppError(400, "VALIDATION_ERROR", "phone is required");
  }
  const email = input.email?.trim();
  if (!email) {
    throw new AppError(400, "VALIDATION_ERROR", "email is required");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, "VALIDATION_ERROR", "email is invalid");
  }
  if (
    !Number.isInteger(input.numberOfPeople) ||
    Number(input.numberOfPeople) < 1
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "numberOfPeople must be at least 1",
    );
  }
  if (!input.timeSlotId) {
    throw new AppError(400, "VALIDATION_ERROR", "timeSlotId is required");
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "items must be a non-empty array",
    );
  }

  validateCartOrderInputLengths(input);
  input.items.forEach((item, index) => {
    if (!item.projectId) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `items[${index}].projectId is required`,
      );
    }
  });
}

function canonicalCartInput(input: CartOrderCreateInput): CanonicalCartInput {
  validateCartOrderInput(input);
  return {
    name: input.name.trim(),
    phone: input.phone.trim(),
    wechat: normalizedOptionalText(input.wechat),
    email: input.email!.trim().toLowerCase(),
    message: normalizedOptionalText(input.message),
    timeSlotId: assertUuid(input.timeSlotId, "timeSlotId"),
    numberOfPeople: input.numberOfPeople!,
    preferredDate: normalizedOptionalText(input.preferredDate),
    locale: input.locale?.toLowerCase().startsWith("zh") ? "zh" : "en",
    items: input.items.map((item, index) => ({
      projectId: assertUuid(item.projectId, `items[${index}].projectId`),
      styleId: item.styleId
        ? assertUuid(item.styleId, `items[${index}].styleId`)
        : null,
    })),
  };
}

function assertReplayMatches(
  existing: PersistedCartReplayIdentity,
  existingItems: PersistedCartItemReplayIdentity[],
  input: CanonicalCartInput,
): void {
  const sameItems =
    existingItems.length === input.items.length &&
    existingItems.every(
      (item, index) =>
        item.projectId === input.items[index]?.projectId &&
        item.styleId === input.items[index]?.styleId,
    );
  const mismatched =
    existing.name !== input.name ||
    existing.phone !== input.phone ||
    existing.wechat !== input.wechat ||
    existing.email !== input.email ||
    existing.message !== input.message ||
    existing.timeSlotId !== input.timeSlotId ||
    existing.numberOfPeople !== input.numberOfPeople ||
    existing.locale !== input.locale ||
    (input.preferredDate !== null &&
      existing.preferredDate !== input.preferredDate) ||
    !sameItems;

  if (mismatched) {
    throw new AppError(
      409,
      "IDEMPOTENCY_KEY_CONFLICT",
      "The idempotency key belongs to a different cart request",
    );
  }
}

function databaseErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== "object" || current === null) return undefined;
    if ("code" in current && typeof current.code === "string") {
      return current.code;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

async function loadStoreContact(db: Db): Promise<StoreContact> {
  const row = await createSettingsRepository(db).findSingleton();
  if (!row) return {};
  return {
    phone: row.phone,
    wechatId: row.wechatId,
    email: row.email,
  };
}

export function createCartOrdersService(
  db: Db,
  requestCapabilities: RequestCapabilities = readRequestCapabilities(),
) {
  const repo = createCartOrdersRepository(db);
  const projectsRepo = createProjectsRepository(db);
  const capacityRepo = createRequestCapacityRepository(db);
  const outboxRepo = createEmailOutboxRepository(db);

  async function replayFor(
    idempotencyKey: string,
    input: CanonicalCartInput,
    tx: Db = db,
  ) {
    const row = await repo.findByIdempotencyKey(idempotencyKey, tx);
    if (!row) return null;
    const items = await repo.findItemsByOrderId(row.id, tx);
    assertReplayMatches(row, items, input);
    return row;
  }

  return {
    async create(
      requestInput: CartOrderCreateInput,
      idempotencyKey?: string,
    ): Promise<CartOrderDto> {
      if (!requestCapabilities.product) {
        throw new AppError(
          503,
          "REQUEST_FLOW_DISABLED",
          "product requests are not currently available",
        );
      }
      const input = canonicalCartInput(requestInput);
      const normalizedKey = requireIdempotencyKey(idempotencyKey);
      const committedReplay = await replayFor(normalizedKey, input);
      if (committedReplay) {
        return {
          id: committedReplay.id,
          status: committedReplay.status,
          createdAt: committedReplay.createdAt,
          replayed: true,
          notification: "queued",
        };
      }

      const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();

      try {
        const result = await db.transaction(async (tx) => {
          await repo.lockCreateAttempt(normalizedKey, tx);
          const replay = await replayFor(normalizedKey, input, tx);
          if (replay) return { row: replay, replayed: true };

          if (
            !ownerEmail ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)
          ) {
            throw new AppError(
              503,
              "EMAIL_NOT_CONFIGURED",
              "Owner email is not configured",
            );
          }

          const verifiedItems: CartOrderItemSnapshot[] = [];
          for (const [index, item] of input.items.entries()) {
            const project = await projectsRepo.findById(item.projectId, tx);
            if (!project) {
              throw new AppError(
                404,
                "PROJECT_NOT_FOUND",
                `Project not found for items[${index}]`,
              );
            }
            if (project.projectType !== "product") {
              throw new AppError(
                422,
                "PROJECT_TYPE_MISMATCH",
                "Cart requests accept product projects only",
              );
            }

            const style = item.styleId
              ? await projectsRepo.findStyleById(item.styleId, tx)
              : null;
            if (item.styleId && !style) {
              throw new AppError(
                404,
                "STYLE_NOT_FOUND",
                `Style not found for items[${index}]`,
              );
            }
            if (style && style.projectId !== project.id) {
              throw new AppError(
                422,
                "STYLE_PROJECT_MISMATCH",
                "The selected style does not belong to the project",
              );
            }

            verifiedItems.push({
              projectId: project.id,
              styleId: style?.id,
              projectName: project.name,
              projectType: "product",
              styleName: style?.name,
              price: style?.price ?? project.priceRange ?? undefined,
              priceCurrency: project.priceCurrency ?? "AUD",
            });
          }

          const slot = await capacityRepo.reserve(
            input.timeSlotId,
            input.numberOfPeople,
            tx,
          );
          if (
            input.preferredDate &&
            input.preferredDate !== slot.date
          ) {
            throw new AppError(
              422,
              "DATE_SLOT_MISMATCH",
              "preferredDate must match the selected time slot",
            );
          }

          const created = await repo.create(
            {
              name: input.name,
              phone: input.phone,
              wechat: input.wechat,
              email: input.email,
              message: input.message,
              timeSlotId: input.timeSlotId,
              numberOfPeople: input.numberOfPeople,
              preferredDate: slot.date,
              slotDate: slot.date,
              slotStartTime: slot.startTime,
              slotEndTime: slot.endTime,
              slotTimezone: slot.timeZone,
              locale: input.locale,
              idempotencyKey: normalizedKey,
              items: verifiedItems,
            },
            tx,
          );
          const contact = await loadStoreContact(tx);
          const orderNumber = formatCartOrderId(
            created.id,
            created.createdAt,
          );
          const emailInput: CartOrderCreateInput = {
            name: created.name,
            phone: created.phone,
            wechat: created.wechat,
            email: input.email,
            message: created.message,
            timeSlotId: input.timeSlotId,
            numberOfPeople: input.numberOfPeople,
            preferredDate: slot.date,
            locale: input.locale,
            items: verifiedItems,
          };

          await outboxRepo.enqueue(
            {
              dedupeKey: `cart-order:${created.id}:received:customer`,
              cartOrderId: created.id,
              messageType: "cart_order_received_customer",
              recipient: input.email,
              locale: input.locale,
              payload: {
                template: "cart_order_received",
                orderNumber,
                submittedAt: created.createdAt.toISOString(),
                input: emailInput,
                contact,
              },
            },
            tx,
          );
          await outboxRepo.enqueue(
            {
              dedupeKey: `cart-order:${created.id}:received:owner`,
              cartOrderId: created.id,
              messageType: "cart_order_received_owner",
              recipient: ownerEmail,
              locale: "en",
              payload: {
                template: "owner_request",
                subject: `New product request ${orderNumber}`,
                heading: "New product request",
                fields: [
                  { label: "Customer", value: created.name },
                  { label: "Phone", value: created.phone },
                  { label: "Email", value: input.email },
                  {
                    label: "Items",
                    value: verifiedItems
                      .map((item) => {
                        const project = displayLocalized(item.projectName);
                        const style = displayLocalized(item.styleName);
                        return style ? `${project} (${style})` : project;
                      })
                      .join(", "),
                  },
                  {
                    label: "Time",
                    value: `${slot.date} ${slot.startTime}–${slot.endTime} Australia/Melbourne`,
                  },
                  {
                    label: "People",
                    value: String(input.numberOfPeople),
                  },
                  { label: "Payment", value: "Pay in store" },
                ],
              },
            },
            tx,
          );

          return { row: created, replayed: false };
        });

        return {
          id: result.row.id,
          status: result.row.status,
          createdAt: result.row.createdAt,
          replayed: result.replayed,
          notification: "queued",
        };
      } catch (error) {
        const concurrentReplay =
          databaseErrorCode(error) === "23505"
            ? await replayFor(normalizedKey, input)
            : null;
        if (concurrentReplay) {
          return {
            id: concurrentReplay.id,
            status: concurrentReplay.status,
            createdAt: concurrentReplay.createdAt,
            replayed: true,
            notification: "queued",
          };
        }
        throw error;
      }
    },
  };
}

export type { CartOrderItemSnapshot };
