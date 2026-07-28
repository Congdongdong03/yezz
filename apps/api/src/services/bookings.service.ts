import type { Db } from "@yezz/db";
import { AppError } from "../lib/errors.js";
import {
  escapeHtml,
  formatBookingOrderId,
  type StoreContact,
} from "../lib/email.js";
import { createEmailOutboxRepository } from "../repositories/email-outbox.repository.js";
import { createSettingsRepository } from "../repositories/settings.repository.js";
import {
  createBookingsRepository,
  type BookingCreateInput,
} from "../repositories/bookings.repository.js";
import { createProjectsRepository } from "../repositories/projects.repository.js";
import { createRequestCapacityRepository } from "../repositories/request-capacity.repository.js";

export type BookingDto = {
  id: string;
  status: string;
  createdAt: Date;
  replayed: boolean;
  notification: "queued";
};

export type BookingsService = ReturnType<typeof createBookingsService>;

export function normalizeBookingPeople(
  value: number | null | undefined,
): number {
  return value ?? 1;
}

export function reservedPeopleForBooking(
  value: number | null,
  timeSlotId: string | null,
): number | null {
  return timeSlotId ? (value ?? 1) : value;
}

export function normalizeBookingInput(
  input: BookingCreateInput,
): BookingCreateInput & { numberOfPeople: number } {
  return {
    ...input,
    numberOfPeople: normalizeBookingPeople(input.numberOfPeople),
  };
}

function validateBookingInput(input: BookingCreateInput) {
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
  if ((input.kind ?? "experience") !== "experience") {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Only experience bookings are supported by this request path",
    );
  }
  if (!input.projectId) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "projectId is required for experience bookings",
    );
  }
  if (!input.timeSlotId) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "timeSlotId is required for experience bookings",
    );
  }
}

function assertUuid(value: string | undefined, field: string): string {
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

export function buildBookingEmailHtml(input: BookingCreateInput): string {
  return `
    <h2>New Booking Received</h2>
    <p><strong>Name:</strong> ${escapeHtml(input.name.trim())}</p>
    <p><strong>Phone:</strong> ${escapeHtml(input.phone.trim())}</p>
    <p><strong>WeChat:</strong> ${escapeHtml(input.wechat?.trim() || "N/A")}</p>
    <p><strong>Email:</strong> ${escapeHtml(input.email?.trim() || "N/A")}</p>
    <p><strong>Date:</strong> ${escapeHtml(input.preferredDate?.trim() || "N/A")}</p>
    <p><strong>People:</strong> ${input.numberOfPeople ?? "N/A"}</p>
    <p><strong>Time slot:</strong> ${escapeHtml(input.timeSlotId || "N/A")}</p>
    <p><strong>Type:</strong> ${escapeHtml(input.activityType?.trim() || "N/A")}</p>
    <p><strong>Project:</strong> ${escapeHtml(input.interestedProject?.trim() || "N/A")}</p>
    <p><strong>Message:</strong> ${escapeHtml(input.message?.trim() || "N/A")}</p>
  `;
}

async function loadStoreContact(db: Db): Promise<StoreContact> {
  const settingsRepo = createSettingsRepository(db);
  const row = await settingsRepo.findSingleton();
  if (!row) return {};
  return {
    phone: row.phone,
    wechatId: row.wechatId,
    email: row.email,
  };
}

export function createBookingsService(db: Db) {
  const repo = createBookingsRepository(db);
  const projectsRepo = createProjectsRepository(db);
  const capacityRepo = createRequestCapacityRepository(db);
  const outboxRepo = createEmailOutboxRepository(db);

  return {
    async create(
      input: BookingCreateInput,
      idempotencyKey?: string,
    ): Promise<BookingDto> {
      validateBookingInput(input);
      const normalizedInput = normalizeBookingInput(input);
      const people = normalizedInput.numberOfPeople;
      const normalizedKey = assertUuid(idempotencyKey, "Idempotency-Key");
      const projectId = assertUuid(normalizedInput.projectId ?? undefined, "projectId");
      const timeSlotId = assertUuid(
        normalizedInput.timeSlotId ?? undefined,
        "timeSlotId",
      );
      const customerEmail = normalizedInput.email!.trim().toLowerCase();
      const locale = normalizedInput.locale?.toLowerCase().startsWith("zh")
        ? "zh"
        : "en";

      const replay = await repo.findByIdempotencyKey(normalizedKey);
      if (replay) {
        return {
          id: replay.id,
          status: replay.status,
          createdAt: replay.createdAt,
          replayed: true,
          notification: "queued",
        };
      }

      const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
      if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
        throw new AppError(
          503,
          "EMAIL_NOT_CONFIGURED",
          "Owner email is not configured",
        );
      }

      try {
        const row = await db.transaction(async (tx) => {
          const existing = await repo.findByIdempotencyKey(normalizedKey, tx);
          if (existing) return existing;

          const project = await projectsRepo.findById(projectId, tx);
          if (!project) {
            throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
          }
          if (project.projectType !== "experience") {
            throw new AppError(
              422,
              "PROJECT_TYPE_MISMATCH",
              "The selected project is not an experience",
            );
          }

          const slot = await capacityRepo.reserve(timeSlotId, people, tx);
          if (slot.categoryId && slot.categoryId !== project.categoryId) {
            throw new AppError(
              422,
              "SLOT_PROJECT_MISMATCH",
              "The selected time slot does not belong to this experience",
            );
          }
          if (
            normalizedInput.preferredDate &&
            normalizedInput.preferredDate !== slot.date
          ) {
            throw new AppError(
              422,
              "DATE_SLOT_MISMATCH",
              "preferredDate must match the selected time slot",
            );
          }

          const created = await repo.create(
            {
              ...normalizedInput,
              kind: "experience",
              requestKind: "experience",
              projectId,
              partyPackageId: null,
              preferredDate: slot.date,
              timeSlotId,
              offeringNameSnapshot: project.name,
              offeringPriceSnapshot: project.priceRange ?? null,
              slotDate: slot.date,
              slotStartTime: slot.startTime,
              slotEndTime: slot.endTime,
              slotTimezone: slot.timeZone,
              idempotencyKey: normalizedKey,
              email: customerEmail,
              locale,
            },
            tx,
          );
          const contact = await loadStoreContact(tx);
          const orderNumber = formatBookingOrderId(
            created.id,
            created.createdAt,
          );
          const localizedProjectName =
            locale === "zh" ? project.name.zh : project.name.en;
          const emailInput: BookingCreateInput = {
            name: created.name,
            phone: created.phone,
            wechat: created.wechat,
            email: customerEmail,
            preferredDate: slot.date,
            numberOfPeople: people,
            activityType: normalizedInput.activityType ?? "experience",
            interestedProject: localizedProjectName,
            message: created.message,
            locale,
            timeSlotId,
          };

          await outboxRepo.enqueue(
            {
              dedupeKey: `booking:${created.id}:received:customer`,
              bookingId: created.id,
              messageType: "booking_received_customer",
              recipient: customerEmail,
              locale,
              payload: {
                template: "booking_received",
                orderId: created.id,
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
              dedupeKey: `booking:${created.id}:received:owner`,
              bookingId: created.id,
              messageType: "booking_received_owner",
              recipient: ownerEmail,
              locale: "en",
              payload: {
                template: "owner_request",
                subject: `New experience booking ${orderNumber}`,
                heading: "New experience booking",
                fields: [
                  { label: "Customer", value: created.name },
                  { label: "Phone", value: created.phone },
                  { label: "Email", value: customerEmail },
                  { label: "Experience", value: localizedProjectName },
                  {
                    label: "Price",
                    value: project.priceRange ?? "Not listed",
                  },
                  {
                    label: "Time",
                    value: `${slot.date} ${slot.startTime}–${slot.endTime} Australia/Melbourne`,
                  },
                  { label: "People", value: String(people) },
                  { label: "Payment", value: "Pay in store" },
                ],
              },
            },
            tx,
          );
          return created;
        });

        return {
          id: row.id,
          status: row.status,
          createdAt: row.createdAt,
          replayed: false,
          notification: "queued",
        };
      } catch (error) {
        const concurrentReplay =
          databaseErrorCode(error) === "23505"
            ? await repo.findByIdempotencyKey(normalizedKey)
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
