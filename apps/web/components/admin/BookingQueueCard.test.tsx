/** @vitest-environment jsdom */

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Booking } from "@/lib/admin/types"
import BookingQueueCard from "./BookingQueueCard"

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const booking: Booking = {
  id: "00000000-0000-4000-8000-000000000001",
  kind: "experience",
  name: "Alice",
  phone: "0430000000",
  wechat: "alice-wechat",
  email: "alice@example.com",
  preferredDate: "2030-08-12",
  numberOfPeople: 2,
  activityType: "experience",
  interestedProject: "Phone case",
  message: null,
  locale: "zh",
  timeSlotId: "00000000-0000-4000-8000-000000000002",
  policyVersion: "2026-07-29",
  policyAcceptedAt: "2026-07-29T01:02:03.000Z",
  attendance: {
    participantCount: 2,
    youngChildCount: 1,
    accompanyingAdultCount: 1,
    totalCount: 3,
    durationMinutes: 60,
  },
  ordinaryDetails: null,
  partyDetails: null,
  status: "pending_review",
  offering: {
    id: "00000000-0000-4000-8000-000000000003",
    name: { en: "Phone case", zh: "手机壳" },
    price: "A$66.00–A$76.00",
  },
  slot: {
    id: "00000000-0000-4000-8000-000000000002",
    date: "2030-08-12",
    startTime: "10:00",
    endTime: "11:00",
    timeZone: "Australia/Melbourne",
  },
  notificationSummary: { latestStatus: "failed", failedCount: 1 },
  statusHistory: [],
  emailDeliveries: [],
  isUnread: true,
  createdAt: "2030-08-01T00:30:00.000Z",
  updatedAt: "2030-08-01T00:30:00.000Z",
}

describe("BookingQueueCard", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    document.body.replaceChildren()
  })

  it("shows the complete counter-workflow summary and valid actions", async () => {
    const onAction = vi.fn()
    await act(async () =>
      root.render(
        <BookingQueueCard
          booking={booking}
          isUpdating={false}
          onAction={onAction}
        />
      )
    )

    const card = container.querySelector(
      `article[aria-labelledby="booking-card-${booking.id}"]`
    )
    expect(card).not.toBeNull()
    expect(card?.textContent).toContain("未读")
    expect(card?.textContent).toContain("体验预约")
    expect(card?.textContent).toContain("待审核")
    expect(card?.textContent).toContain("Alice")
    expect(card?.textContent).toContain("手机壳")
    expect(card?.textContent).toContain("A$66.00–A$76.00")
    expect(card?.textContent).toContain("2030-08-12")
    expect(card?.textContent).toContain("10:00–11:00")
    expect(card?.textContent).toContain(
      "2 位制作，1 名儿童，1 位陪同（共 3 人）"
    )
    expect(card?.textContent).toContain("政策 2026-07-29")
    expect(card?.textContent).toContain("发送失败")
    expect(card?.textContent).toContain("1 封发送失败")
    expect(card?.querySelector("a[href='tel:0430000000']")).not.toBeNull()
    expect(
      card?.querySelector("a[href='mailto:alice@example.com']")
    ).not.toBeNull()
    expect(
      card?.querySelector(
        `a[href='/admin/bookings/${booking.id}'][aria-label='查看 Alice 的预约详情']`
      )
    ).not.toBeNull()

    const confirm = card?.querySelector<HTMLButtonElement>(
      "button[aria-label='确认 Alice']"
    )
    expect(confirm).not.toBeNull()
    await act(async () => confirm?.click())
    expect(onAction).toHaveBeenCalledWith("confirm")
  })

  it("disables every workflow action while the booking is updating", async () => {
    await act(async () =>
      root.render(
        <BookingQueueCard booking={booking} isUpdating onAction={vi.fn()} />
      )
    )

    const actions = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        "button[data-booking-action]"
      )
    )
    expect(actions).toHaveLength(3)
    expect(actions.every((button) => button.disabled)).toBe(true)
  })
})
