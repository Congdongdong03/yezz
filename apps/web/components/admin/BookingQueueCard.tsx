"use client"

import Link from "next/link"
import {
  bookingActionsFor,
  type BookingWorkflowAction,
} from "@/lib/admin/booking-status"
import {
  BOOKING_ACTION_LABELS,
  BOOKING_STATUS_LABELS,
  formatBookingQueueAttendance,
  formatBookingQueueDate,
  getBookingQueueDeliverySummary,
  getBookingQueueOfferingName,
} from "@/lib/admin/booking-queue"
import type { Booking } from "@/lib/admin/types"

type BookingQueueCardProps = {
  booking: Booking
  isUpdating: boolean
  onAction: (action: BookingWorkflowAction) => void
}

export default function BookingQueueCard({
  booking,
  isUpdating,
  onAction,
}: BookingQueueCardProps) {
  const actions = bookingActionsFor(booking.kind, booking.status)
  const delivery = getBookingQueueDeliverySummary(booking)

  return (
    <article
      aria-labelledby={`booking-card-${booking.id}`}
      className="overflow-hidden rounded-2xl border border-[#DED9D7] bg-white shadow-[0_12px_32px_rgba(45,45,47,0.06)]"
    >
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          {booking.isUnread && (
            <span className="rounded-full bg-primary px-2.5 py-1 text-primary-foreground">
              未读
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-1 text-warm-charcoal ${
              booking.kind === "party" ? "bg-soft-pink/40" : "bg-sage/25"
            }`}
          >
            {booking.kind === "party" ? "聚会预约" : "体验预约"}
          </span>
          <span className="ml-auto border-l-2 border-[#D96F9E] pl-2 text-warm-charcoal">
            {BOOKING_STATUS_LABELS[booking.status]}
          </span>
        </div>

        <div>
          <h2
            className="font-serif text-xl font-semibold text-warm-charcoal"
            id={`booking-card-${booking.id}`}
          >
            {booking.name}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            提交于 {formatBookingQueueDate(booking.createdAt)}
          </p>
        </div>

        <div className="grid gap-2 rounded-xl bg-[#FBF8F6] p-3 text-sm">
          <a
            className="font-medium hover:underline"
            href={`tel:${booking.phone}`}
          >
            {booking.phone}
          </a>
          {booking.wechat && (
            <span className="text-muted-foreground">
              微信：{booking.wechat}
            </span>
          )}
          {booking.email && (
            <a
              className="break-all text-muted-foreground hover:underline"
              href={`mailto:${booking.email}`}
            >
              {booking.email}
            </a>
          )}
        </div>

        <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">预约项目</dt>
          <dd className="font-medium text-warm-charcoal">
            {getBookingQueueOfferingName(booking)}
            {booking.offering?.price && (
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                {booking.offering.price}
              </span>
            )}
          </dd>

          <dt className="text-muted-foreground">预约时段</dt>
          <dd className="text-warm-charcoal">
            {booking.slot ? (
              <>
                {booking.slot.date}
                <span className="ml-2 text-muted-foreground">
                  {booking.slot.startTime && booking.slot.endTime
                    ? `${booking.slot.startTime}–${booking.slot.endTime}`
                    : "历史记录无具体时间"}
                </span>
              </>
            ) : (
              "资料不完整"
            )}
          </dd>

          <dt className="text-muted-foreground">到店人数</dt>
          <dd className="text-warm-charcoal">
            {formatBookingQueueAttendance(booking)}
          </dd>

          <dt className="text-muted-foreground">预约政策</dt>
          <dd className="text-warm-charcoal">
            政策 {booking.policyVersion ?? "历史记录未记录"}
          </dd>

          <dt className="text-muted-foreground">邮件状态</dt>
          <dd
            className={
              delivery.failureLabel ? "text-destructive" : "text-warm-charcoal"
            }
          >
            {delivery.label}
            {delivery.failureLabel && (
              <span className="ml-2 text-xs">{delivery.failureLabel}</span>
            )}
          </dd>
        </dl>
      </div>

      <div className="border-t border-[#EAE4E1] bg-[#FFFDFC] p-3">
        {actions.length > 0 && (
          <div className="mb-2 grid grid-cols-2 gap-2">
            {actions.map((action) => (
              <button
                aria-label={`${BOOKING_ACTION_LABELS[action]} ${booking.name}`}
                className="min-h-10 rounded-xl border border-[#DED9D7] bg-white px-3 py-2 text-sm font-medium text-warm-charcoal transition-colors hover:border-[#D96F9E] hover:bg-soft-pink/15 focus-visible:outline-2 disabled:opacity-50"
                data-booking-action={action}
                disabled={isUpdating}
                key={action}
                onClick={() => onAction(action)}
                type="button"
              >
                {BOOKING_ACTION_LABELS[action]}
              </button>
            ))}
          </div>
        )}
        <Link
          aria-label={`查看 ${booking.name} 的预约详情`}
          className="flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          href={`/admin/bookings/${booking.id}`}
        >
          查看完整预约
        </Link>
      </div>
    </article>
  )
}
