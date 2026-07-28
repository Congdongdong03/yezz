/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartOrder } from "@/lib/admin/types";
import AdminOrderDetailPage from "./page";

const api = vi.hoisted(() => ({
  getAdminOrder: vi.fn(),
  updateOrderStatus: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock("@/lib/admin/api", () => api);

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

const detail = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Alice",
  phone: "0430000000",
  wechat: "alice-wechat",
  email: "alice@example.com",
  message: "Please call",
  preferredDate: "2030-08-12",
  numberOfPeople: 2,
  locale: "zh",
  timeSlotId: "00000000-0000-4000-8000-000000000002",
  slot: {
    id: "00000000-0000-4000-8000-000000000002",
    date: "2030-08-12",
    startTime: "10:00",
    endTime: "11:00",
    timeZone: "Australia/Melbourne",
  },
  status: "confirmed",
  items: [
    {
      id: "item-1",
      projectId: "00000000-0000-4000-8000-000000000003",
      styleId: "00000000-0000-4000-8000-000000000004",
      projectName: { en: "Phone case", zh: "手机壳" },
      projectType: "product",
      styleName: { en: "Pink", zh: "粉色" },
      date: null,
      people: null,
      price: "$49",
      priceCurrency: "AUD",
      sortOrder: 0,
    },
  ],
  notificationSummary: { latestStatus: "sent", failedCount: 0 },
  statusHistory: [
    {
      id: "event-1",
      operationId: "00000000-0000-4000-8000-000000000005",
      fromStatus: "new",
      toStatus: "confirmed",
      note: "Confirmed by phone",
      createdAt: "2030-08-01T01:00:00.000Z",
      actor: {
        id: "staff-1",
        name: "值班员工",
        email: "staff@example.com",
      },
    },
  ],
  emailDeliveries: [
    {
      id: "delivery-1",
      messageType: "cart_order_status_customer",
      recipient: "alice@example.com",
      deliveryStatus: "sent",
      attemptCount: 1,
      lastError: null,
      sentAt: "2030-08-01T01:01:00.000Z",
      updatedAt: "2030-08-01T01:01:00.000Z",
    },
  ],
  createdAt: "2030-08-01T00:00:00.000Z",
  updatedAt: "2030-08-01T01:00:00.000Z",
} as unknown as CartOrder;

describe("AdminOrderDetailPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    api.getAdminOrder.mockReset().mockResolvedValue(detail);
    api.updateOrderStatus.mockReset();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it("shows exact request snapshots, status history, and email delivery", async () => {
    await act(async () =>
      root.render(
        <AdminOrderDetailPage
          params={Promise.resolve({
            id: "00000000-0000-4000-8000-000000000001",
          })}
        />,
      ),
    );
    await act(async () => {});

    expect(container.textContent).toContain("alice@example.com");
    expect(container.textContent).toContain(
      "2030-08-12 10:00–11:00 Australia/Melbourne",
    );
    expect(container.textContent).toContain("人数");
    expect(container.textContent).toContain("2");
    expect(container.textContent).toContain("手机壳");
    expect(container.textContent).toContain("粉色");
    expect(container.textContent).toContain("$49 AUD");
    expect(container.textContent).toContain("状态记录");
    expect(container.textContent).toContain("值班员工");
    expect(container.textContent).toContain("Confirmed by phone");
    expect(container.textContent).toContain("已发送");
  });
});
