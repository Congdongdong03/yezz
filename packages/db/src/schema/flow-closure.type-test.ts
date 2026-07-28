import {
  adminRequestReads,
  bookings,
  cartOrders,
  emailOutbox,
  requestRateLimits,
  requestStatusEvents,
} from "./index.js";

void bookings.requestKind;
void bookings.slotStartTime;
void bookings.idempotencyKey;
void cartOrders.timeSlotId;
void cartOrders.idempotencyKey;
void requestRateLimits.subjectHash;
void requestStatusEvents.operationId;
void emailOutbox.deliveryStatus;
void adminRequestReads.userId;
