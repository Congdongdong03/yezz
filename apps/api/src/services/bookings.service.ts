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
import { createPartiesRepository } from "../repositories/parties.repository.js";
import { createProjectsRepository } from "../repositories/projects.repository.js";
import { createRequestCapacityRepository } from "../repositories/request-capacity.repository.js";
import {
  readRequestCapabilities,
  type RequestCapabilities,
} from "./settings.service.js";

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
  const kind = input.kind ?? "experience";
  if (kind !== "experience" && kind !== "party") {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "kind must be experience or party",
    );
  }
  if (kind === "experience" && (!input.projectId || input.partyPackageId)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "experience bookings require projectId and forbid partyPackageId",
    );
  }
  if (kind === "party" && (!input.partyPackageId || input.projectId)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "party bookings require partyPackageId and forbid projectId",
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

type PersistedBookingReplayIdentity = {
  requestKind: string;
  projectId: string | null;
  partyPackageId: string | null;
  timeSlotId: string | null;
  name: string;
  phone: string;
  wechat: string | null;
  email: string | null;
  preferredDate: string | null;
  numberOfPeople: number | null;
  activityType: string | null;
  interestedProject: string | null;
  message: string | null;
  locale: string | null;
};

function normalizedOptionalText(
  value: string | null | undefined,
): string | null {
  return value?.trim() || null;
}

function assertReplayMatches(
  existing: PersistedBookingReplayIdentity,
  input: BookingCreateInput & { numberOfPeople: number },
  identity: {
    kind: "experience" | "party";
    projectId: string | null;
    partyPackageId: string | null;
    timeSlotId: string;
    customerEmail: string;
    locale: "en" | "zh";
  },
): void {
  const mismatched =
    existing.requestKind !== identity.kind ||
    existing.projectId !== identity.projectId ||
    existing.partyPackageId !== identity.partyPackageId ||
    existing.timeSlotId !== identity.timeSlotId ||
    existing.name !== input.name.trim() ||
    existing.phone !== input.phone.trim() ||
    existing.wechat !== normalizedOptionalText(input.wechat) ||
    existing.email !== identity.customerEmail ||
    existing.numberOfPeople !== input.numberOfPeople ||
    existing.activityType !== normalizedOptionalText(input.activityType) ||
    existing.interestedProject !==
      normalizedOptionalText(input.interestedProject) ||
    existing.message !== normalizedOptionalText(input.message) ||
    existing.locale !== identity.locale ||
    (normalizedOptionalText(input.preferredDate) !== null &&
      existing.preferredDate !== normalizedOptionalText(input.preferredDate));

  if (mismatched) {
    throw new AppError(
      409,
      "IDEMPOTENCY_KEY_CONFLICT",
      "The idempotency key belongs to a different booking request",
    );
  }
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

export function createBookingsService(
  db: Db,
  requestCapabilities: RequestCapabilities = readRequestCapabilities(),
) {
  const repo = createBookingsRepository(db);
  const projectsRepo = createProjectsRepository(db);
  const partiesRepo = createPartiesRepository(db);
  const capacityRepo = createRequestCapacityRepository(db);
  const outboxRepo = createEmailOutboxRepository(db);

  return {
    async create(
      input: BookingCreateInput,
      idempotencyKey?: string,
    ): Promise<BookingDto> {
      const requestedKind = input.kind ?? "experience";
      if (!requestCapabilities[requestedKind]) {
        throw new AppError(
          503,
          "REQUEST_FLOW_DISABLED",
          `${requestedKind} requests are not currently available`,
        );
      }
      validateBookingInput(input);
      const normalizedInput = normalizeBookingInput(input);
      const people = normalizedInput.numberOfPeople;
      const normalizedKey = assertUuid(idempotencyKey, "Idempotency-Key");
      const kind = normalizedInput.kind ?? "experience";
      const projectId =
        kind === "experience"
          ? assertUuid(normalizedInput.projectId ?? undefined, "projectId")
          : null;
      const partyPackageId =
        kind === "party"
          ? assertUuid(
              normalizedInput.partyPackageId ?? undefined,
              "partyPackageId",
            )
          : null;
      const timeSlotId = assertUuid(
        normalizedInput.timeSlotId ?? undefined,
        "timeSlotId",
      );
      const customerEmail = normalizedInput.email!.trim().toLowerCase();
      const locale = normalizedInput.locale?.toLowerCase().startsWith("zh")
        ? "zh"
        : "en";
      const replayIdentity = {
        kind,
        projectId,
        partyPackageId,
        timeSlotId,
        customerEmail,
        locale,
      } as const;

      const replay = await repo.findByIdempotencyKey(normalizedKey);
      if (replay) {
        assertReplayMatches(replay, normalizedInput, replayIdentity);
        return {
          id: replay.id,
          status: replay.status,
          createdAt: replay.createdAt,
          replayed: true,
          notification: "queued",
        };
      }

      const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();

      try {
        const result = await db.transaction(async (tx) => {
          await repo.lockCreateAttempt(normalizedKey, tx);
          const existing = await repo.findByIdempotencyKey(normalizedKey, tx);
          if (existing) {
            assertReplayMatches(existing, normalizedInput, replayIdentity);
            return { row: existing, replayed: true };
          }

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

          const offering =
            kind === "experience"
              ? await projectsRepo.findById(projectId!, tx)
              : await partiesRepo.findById(partyPackageId!, tx);
          if (!offering) {
            throw new AppError(
              404,
              kind === "party"
                ? "PARTY_PACKAGE_NOT_FOUND"
                : "PROJECT_NOT_FOUND",
              kind === "party"
                ? "Party package not found"
                : "Project not found",
            );
          }
          if (
            kind === "experience" &&
            "projectType" in offering &&
            offering.projectType !== "experience"
          ) {
            throw new AppError(
              422,
              "PROJECT_TYPE_MISMATCH",
              "The selected project is not an experience",
            );
          }
          if (
            kind === "party" &&
            "minPeople" in offering &&
            (people < offering.minPeople || people > offering.maxPeople)
          ) {
            throw new AppError(
              422,
              "PARTY_SIZE_INVALID",
              `Party size must be between ${offering.minPeople} and ${offering.maxPeople}`,
              {
                minPeople: offering.minPeople,
                maxPeople: offering.maxPeople,
              },
            );
          }

          const slot = await capacityRepo.reserve(timeSlotId, people, tx);
          if (
            kind === "experience" &&
            "categoryId" in offering &&
            slot.categoryId &&
            slot.categoryId !== offering.categoryId
          ) {
            throw new AppError(
              422,
              "SLOT_PROJECT_MISMATCH",
              "The selected time slot does not belong to this experience",
            );
          }
          if (kind === "party" && slot.categoryId !== null) {
            throw new AppError(
              422,
              "SLOT_PARTY_MISMATCH",
              "The selected time slot is reserved for an experience category",
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
              kind,
              requestKind: kind,
              projectId,
              partyPackageId,
              preferredDate: slot.date,
              timeSlotId,
              offeringNameSnapshot: offering.name,
              offeringPriceSnapshot:
                ("priceRange" in offering
                  ? offering.priceRange
                  : offering.priceIndicator) ?? null,
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
          const localizedOfferingName =
            locale === "zh" ? offering.name.zh : offering.name.en;
          const offeringPrice =
            ("priceRange" in offering
              ? offering.priceRange
              : offering.priceIndicator) ?? null;
          const emailInput: BookingCreateInput = {
            name: created.name,
            phone: created.phone,
            wechat: created.wechat,
            email: customerEmail,
            preferredDate: slot.date,
            numberOfPeople: people,
            activityType: normalizedInput.activityType ?? kind,
            interestedProject: localizedOfferingName,
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
                subject: `New ${kind} booking ${orderNumber}`,
                heading: `New ${kind} booking`,
                fields: [
                  { label: "Customer", value: created.name },
                  { label: "Phone", value: created.phone },
                  { label: "Email", value: customerEmail },
                  {
                    label:
                      kind === "party" ? "Party package" : "Experience",
                    value: localizedOfferingName,
                  },
                  {
                    label: "Price",
                    value: offeringPrice ?? "Not listed",
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
            ? await repo.findByIdempotencyKey(normalizedKey)
            : null;
        if (concurrentReplay) {
          assertReplayMatches(
            concurrentReplay,
            normalizedInput,
            replayIdentity,
          );
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
