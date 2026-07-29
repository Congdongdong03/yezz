import type { BookingStatus, Db } from "@yezz/db";
import { AppError } from "../lib/errors.js";
import {
  buildOrdinaryInterval,
  type OrdinaryBookingCreateInput,
  validateOrdinaryAttendance,
} from "../lib/booking-workflow.js";
import { getMelbourneClock, validateBookingWindow } from "../lib/booking-policy.js";
import { legacyStatusFromBookingStatus } from "../lib/legacy-booking-status.js";
import {
  escapeHtml,
  formatBookingOrderId,
  type StoreContact,
} from "../lib/email.js";
import { CANONICAL_BOOKING_EMAIL_IDENTITY } from "../lib/email-outbox-payload.js";
import {
  bookingOfferingLabel,
  customerManageUrl,
  issueDeterministicManagementToken,
  notificationPayload,
  staffBookingUrl,
} from "../lib/booking-notification.js";
import { createEmailOutboxRepository } from "../repositories/email-outbox.repository.js";
import { createSettingsRepository } from "../repositories/settings.repository.js";
import {
  createBookingsRepository,
  type BookingCreateInput,
} from "../repositories/bookings.repository.js";
import { createPartiesRepository } from "../repositories/parties.repository.js";
import { createProjectsRepository } from "../repositories/projects.repository.js";
import { createRequestCapacityRepository } from "../repositories/request-capacity.repository.js";
import { createStudioScheduleRepository } from "../repositories/studio-schedule.repository.js";
import { createStatusEventsRepository } from "../repositories/status-events.repository.js";
import {
  readRequestCapabilities,
  requireEffectiveRequestCapability,
  type RequestCapabilities,
} from "./settings.service.js";
import {
  createPartyWorkflowService,
  type PartyCreateInput,
} from "./party-workflow.service.js";

export type BookingDto = {
  id: string;
  status: "new" | "contacted" | "confirmed" | "cancelled";
  createdAt: Date;
  replayed: boolean;
  notification: "queued";
};

export type BookingsService = ReturnType<typeof createBookingsService>;
export type { OrdinaryBookingCreateInput } from "../lib/booking-workflow.js";

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

function isOrdinaryBookingCreateInput(input: BookingCreateInput | OrdinaryBookingCreateInput): input is OrdinaryBookingCreateInput {
  return "mode" in input && "items" in input && "participantCount" in input;
}

function assertOrdinaryInput(input: OrdinaryBookingCreateInput): void {
  if (!input.name.trim() || !input.phone.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    throw new AppError(400, "VALIDATION_ERROR", "name, phone, and a valid email are required");
  }
  if (!input.policyAccepted || input.policyVersion !== "2026-07-29") {
    throw new AppError(400, "VALIDATION_ERROR", "The current booking policy must be accepted");
  }
  if (input.mode !== "booking" && input.mode !== "waitlist") {
    throw new AppError(400, "VALIDATION_ERROR", "mode must be booking or waitlist");
  }
  validateOrdinaryAttendance(input);
  if (!input.items.length || input.items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
    throw new AppError(400, "VALIDATION_ERROR", "items must contain positive quantities");
  }
  if (input.items.reduce((total, item) => total + item.quantity, 0) !== input.participantCount) {
    throw new AppError(400, "VALIDATION_ERROR", "project quantity must equal participantCount");
  }
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
  return {
    phone: CANONICAL_BOOKING_EMAIL_IDENTITY.contactPhone,
    wechatId: row?.wechatId ?? null,
    email: CANONICAL_BOOKING_EMAIL_IDENTITY.contactEmail,
  };
}

export function createBookingsService(
  db: Db,
  requestCapabilities: RequestCapabilities = readRequestCapabilities(),
  dependencies?: {
    now?: () => Date;
    customerActionTokenSecret?: string;
    customerManageBaseUrl?: string;
  },
) {
  const repo = createBookingsRepository(db);
  const projectsRepo = createProjectsRepository(db);
  const partiesRepo = createPartiesRepository(db);
  const capacityRepo = createRequestCapacityRepository(db);
  const scheduleRepo = createStudioScheduleRepository(db);
  const outboxRepo = createEmailOutboxRepository(db);
  const statusEventsRepo = createStatusEventsRepository(db);
  const now = dependencies?.now ?? (() => new Date());

  async function requirePublicCreateCapability(
    kind: "experience" | "party" | "product",
    tx: Db = db,
  ): Promise<void> {
    const settings = await createSettingsRepository(tx).findSingleton();
    if (!settings) {
      throw new AppError(
        503,
        "REQUEST_FLOW_DISABLED",
        "requests are not currently available",
      );
    }
    requireEffectiveRequestCapability(kind, settings, {
      REQUEST_FLOW_EXPERIENCE_ENABLED: requestCapabilities.experience
        ? "true"
        : "false",
      REQUEST_FLOW_PARTY_ENABLED: requestCapabilities.party ? "true" : "false",
      REQUEST_FLOW_PRODUCT_ENABLED: "false",
    });
  }

  return {
    async create(
      input: BookingCreateInput | OrdinaryBookingCreateInput,
      idempotencyKey?: string,
    ): Promise<BookingDto> {
      if (isOrdinaryBookingCreateInput(input)) {
        return this.createOrdinaryRequest(input, idempotencyKey) as Promise<BookingDto>;
      }
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

      await requirePublicCreateCapability(kind);
      const replay = await repo.findByIdempotencyKey(normalizedKey);
      if (replay) {
        assertReplayMatches(replay, normalizedInput, replayIdentity);
        return {
          id: replay.id,
          status: legacyStatusFromBookingStatus(replay.status),
          createdAt: replay.createdAt,
          replayed: true,
          notification: "queued",
        };
      }

      const ownerEmail = CANONICAL_BOOKING_EMAIL_IDENTITY.contactEmail;

      try {
        const result = await db.transaction(async (tx) => {
          await requirePublicCreateCapability(kind, tx);
          await repo.lockCreateAttempt(normalizedKey, tx);
          const existing = await repo.findByIdempotencyKey(normalizedKey, tx);
          if (existing) {
            assertReplayMatches(existing, normalizedInput, replayIdentity);
            return { row: existing, replayed: true };
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
                storeName: CANONICAL_BOOKING_EMAIL_IDENTITY.storeName,
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
          status: legacyStatusFromBookingStatus(result.row.status),
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
            status: legacyStatusFromBookingStatus(concurrentReplay.status),
            createdAt: concurrentReplay.createdAt,
            replayed: true,
            notification: "queued",
          };
        }
        throw error;
      }
    },

    async createOrdinaryRequest(
      input: OrdinaryBookingCreateInput,
      idempotencyKey?: string,
    ): Promise<{
      id: string;
      status: BookingStatus;
      createdAt: Date;
      replayed: boolean;
      notification: "queued";
    }> {
      if (!requestCapabilities.experience) {
        throw new AppError(503, "REQUEST_FLOW_DISABLED", "experience requests are not currently available");
      }
      assertOrdinaryInput(input);
      const normalizedKey = assertUuid(idempotencyKey, "Idempotency-Key");
      await requirePublicCreateCapability("experience");
      const existing = await repo.findByIdempotencyKey(normalizedKey);
      const assertReplay = async (row: Awaited<ReturnType<typeof repo.findByIdempotencyKey>>) => {
        if (!row) return false;
        const items = await repo.findItems(row.id);
        const same = row.requestKind === "experience" && row.activityType === `ordinary_${input.mode}` && row.participantCount === input.participantCount && row.youngChildCount === input.youngChildCount && row.accompanyingAdultCount === input.accompanyingAdultCount && row.slotDate === input.date && row.slotStartTime === input.startTime && row.name === input.name.trim() && row.phone === input.phone.trim() && row.email === input.email.trim().toLowerCase() && row.message === (input.message?.trim() || null) && row.locale === input.locale && row.policyVersion === input.policyVersion && Boolean(row.policyAcceptedAt) && items.length === input.items.length && items.every((item, index) => item.projectId === (input.items[index]?.decideInStore ? null : input.items[index]?.projectId) && item.quantity === input.items[index]?.quantity && item.decideInStore === Boolean(input.items[index]?.decideInStore));
        if (!same) throw new AppError(409, "IDEMPOTENCY_KEY_CONFLICT", "The idempotency key belongs to a different booking request");
        return true;
      };
      if (await assertReplay(existing)) {
        return { id: existing!.id, status: existing!.status, createdAt: existing!.createdAt, replayed: true, notification: "queued" };
      }

      const result = await db.transaction(async (tx) => {
        await requirePublicCreateCapability("experience", tx);
        await repo.lockCreateAttempt(normalizedKey, tx);
        const replay = await repo.findByIdempotencyKey(normalizedKey, tx);
        if (replay) {
          if (!(await assertReplay(replay))) throw new Error("unreachable");
          return { row: replay, replayed: true };
        }
        const snapshots = [] as Array<{ projectId: string | null; projectNameSnapshot: { en: string; zh: string } | null; unitPriceCentsSnapshot: number | null; durationMinutesSnapshot: number; quantity: number; decideInStore: boolean }>;
        for (const item of input.items) {
          if (item.decideInStore) {
            snapshots.push({ projectId: null, projectNameSnapshot: { en: "Decide in store", zh: "到店决定" }, unitPriceCentsSnapshot: null, durationMinutesSnapshot: 60, quantity: item.quantity, decideInStore: true });
            continue;
          }
          const project = await projectsRepo.findById(assertUuid(item.projectId, "projectId"), tx);
          if (!project || project.projectType !== "experience" || !project.bookable || !project.durationMinutes) {
            throw new AppError(422, "PROJECT_NOT_BOOKABLE", "The selected project is not available for booking");
          }
          snapshots.push({ projectId: project.id, projectNameSnapshot: project.name, unitPriceCentsSnapshot: project.priceMin ?? null, durationMinutesSnapshot: project.durationMinutes, quantity: item.quantity, decideInStore: false });
        }
        const interval = buildOrdinaryInterval({ date: input.date, startTime: input.startTime, participantCount: input.participantCount, accompanyingAdultCount: input.accompanyingAdultCount, itemDurations: snapshots.map((item) => item.durationMinutesSnapshot) });
        const schedule = await scheduleRepo.resolveDay(input.date);
        if (schedule.isClosed || !schedule.opensAt || !schedule.closesAt) throw new AppError(400, "STUDIO_CLOSED", "The studio is closed on this date");
        if (schedule.closures.some((closure) => closure.startTime === null || closure.endTime === null || (input.startTime < closure.endTime && interval.endTime > closure.startTime))) {
          throw new AppError(409, "SCHEDULE_CONFLICT", "The requested interval is unavailable due to the studio schedule");
        }
        validateBookingWindow({ date: input.date, startTime: input.startTime, durationMinutes: interval.durationMinutes as 30 | 60 | 90 | 150 }, getMelbourneClock(now()), { opensAt: schedule.opensAt, closesAt: schedule.closesAt });
        const created = await repo.createOrdinary({ ...input, email: input.email.trim().toLowerCase(), endTime: interval.endTime, attendanceCount: interval.attendanceCount, durationMinutes: interval.durationMinutes, idempotencyKey: normalizedKey, status: input.mode === "waitlist" ? "waitlisted" : "pending_review", submissionMode: input.mode, items: snapshots }, tx);
        const messageLocale = input.locale;
        const customerEmail = input.email.trim().toLowerCase();
        const offeringLabel = snapshots
          .map((item) =>
            bookingOfferingLabel(
              item.projectNameSnapshot,
              messageLocale,
              "experience",
            ),
          )
          .join(", ");
        const contact = await loadStoreContact(tx);
        if (input.mode === "booking") {
          await outboxRepo.enqueue(
            {
              dedupeKey: `booking:${created.id}:received:customer`,
              bookingId: created.id,
              messageType: "booking_received_customer",
              recipient: customerEmail,
              locale: messageLocale,
              payload: {
                template: "booking_received",
                storeName: CANONICAL_BOOKING_EMAIL_IDENTITY.storeName,
                orderId: created.id,
                orderNumber: formatBookingOrderId(created.id, created.createdAt),
                submittedAt: created.createdAt.toISOString(),
                input: {
                  name: created.name,
                  phone: created.phone,
                  email: customerEmail,
                  preferredDate: input.date,
                  numberOfPeople: input.participantCount,
                  activityType: "ordinary_booking",
                  interestedProject: offeringLabel,
                  message: created.message,
                  locale: messageLocale,
                },
                contact,
              },
            },
            tx,
          );
        } else {
          const initialWaitlistEvent = await statusEventsRepo.createBooking(
            {
              bookingId: created.id,
              operationId: normalizedKey,
              fromStatus: "pending_review",
              toStatus: "waitlisted",
              actorUserId: null,
              actorKind: "system",
            },
            tx,
          );
          const rawToken = await issueDeterministicManagementToken(
            {
              bookingId: created.id,
              identity: `event:${initialWaitlistEvent.id}:booking_waitlisted`,
              now: now(),
              secret: dependencies?.customerActionTokenSecret,
            },
            tx,
          );
          await outboxRepo.enqueue(
            {
              dedupeKey: `booking:${created.id}:event:${initialWaitlistEvent.id}:booking_waitlisted:customer`,
              bookingId: created.id,
              statusEventId: initialWaitlistEvent.id,
              messageType: "booking_notification_customer",
              recipient: customerEmail,
              locale: messageLocale,
              payload: notificationPayload({
                template: "booking_waitlisted",
                booking: created,
                locale: messageLocale,
                date: input.date,
                startTime: input.startTime,
                endTime: interval.endTime,
                manageUrl: customerManageUrl(
                  messageLocale,
                  rawToken,
                  dependencies?.customerManageBaseUrl,
                ),
              }),
            },
            tx,
          );
        }
        await outboxRepo.enqueue(
          {
            dedupeKey: `booking:${created.id}:created:staff_notification:owner`,
            bookingId: created.id,
            messageType: "booking_notification_owner",
            recipient: CANONICAL_BOOKING_EMAIL_IDENTITY.contactEmail,
            locale: "en",
            payload: notificationPayload({
              template: "staff_notification",
              booking: created,
              locale: "en",
              date: input.date,
              startTime: input.startTime,
              endTime: interval.endTime,
              manageUrl: staffBookingUrl(
                created.id,
                dependencies?.customerManageBaseUrl,
              ),
              note:
                input.mode === "waitlist"
                  ? "New ordinary waitlist request"
                  : "New ordinary booking request",
              customerEmail,
              customerPhone: created.phone,
            }),
          },
          tx,
        );
        return { row: created, replayed: false };
      });
      return { id: result.row.id, status: result.row.status, createdAt: result.row.createdAt, replayed: result.replayed, notification: "queued" };
    },

    async createPartyRequest(input: PartyCreateInput, idempotencyKey?: string) {
      if (!requestCapabilities.party) {
        throw new AppError(
          503,
          "REQUEST_FLOW_DISABLED",
          "party requests are not currently available",
        );
      }
      return createPartyWorkflowService(db, {
        now,
        requirePublicRequestCapability: (tx) =>
          requirePublicCreateCapability("party", tx),
      }).createPartyRequest(input, idempotencyKey);
    },
  };
}
