/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ProjectQuantityPicker, {
  type OrdinaryBookingProject,
  type OrdinaryBookingItemSelection,
} from "./ProjectQuantityPicker";

const projects: OrdinaryBookingProject[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: { en: "Beading", zh: "串珠" },
    durationMinutes: 30,
    priceDisplay: "A$43",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: { en: "Paint clay figurine", zh: "彩绘黏土摆件" },
    durationMinutes: 60,
    priceDisplay: "A$27.50",
  },
];

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("ProjectQuantityPicker", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: OrdinaryBookingItemSelection[];

  beforeEach(() => {
    latest = [];
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  async function renderPicker(participantCount = 2, locale: "en" | "zh" = "en") {
    await act(async () =>
      root.render(
        <ProjectQuantityPicker
          locale={locale}
          onChange={(items) => {
            latest = items;
          }}
          participantCount={participantCount}
          projects={projects}
        />,
      ),
    );
  }

  function change(label: string, value: string) {
    const input = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="number"]'),
    ).find((candidate) => candidate.getAttribute("aria-label") === label);
    expect(input).not.toBeUndefined();
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
    input?.dispatchEvent(new Event("change", { bubbles: true }));
  }

  it("uses the longest selected project and requires one project quantity per participant", async () => {
    await renderPicker();

    await act(async () => {
      change("Beading quantity", "1");
      change("Paint clay figurine quantity", "1");
    });

    expect(container.textContent).toContain(
      "Estimated booking time: 60 minutes",
    );
    expect(container.textContent).toContain("2 of 2 participants assigned");
    expect(latest).toEqual([
      {
        projectId: "00000000-0000-4000-8000-000000000001",
        quantity: 1,
        decideInStore: false,
      },
      {
        projectId: "00000000-0000-4000-8000-000000000002",
        quantity: 1,
        decideInStore: false,
      },
    ]);
  });

  it("reserves 60 minutes for Decide in store and creates no online price snapshot", async () => {
    await renderPicker(1);

    await act(async () => {
      change("Decide in store quantity", "1");
    });

    expect(container.textContent).toContain(
      "Choose your project when you arrive",
    );
    expect(container.textContent).toContain("No online price snapshot");
    expect(container.textContent).toContain(
      "Estimated booking time: 60 minutes",
    );
    expect(latest).toEqual([
      { quantity: 1, decideInStore: true },
    ]);
  });

  it("exposes thumb-sized semantic quantity controls and a linked parity error", async () => {
    await renderPicker(2);

    const inputs = container.querySelectorAll<HTMLInputElement>(
      'input[type="number"]',
    );
    expect(inputs.length).toBe(3);
    for (const input of inputs) {
      expect(input.min).toBe("0");
      expect(input.inputMode).toBe("numeric");
      expect(input.className).toContain("min-h-11");
    }

    expect(container.textContent).toContain(
      "Choose exactly one project for each DIY participant",
    );
    expect(
      container.querySelector('[data-testid="project-parity-error"]')?.getAttribute(
        "role",
      ),
    ).toBe("alert");
  });

  it("provides equivalent duration, price, and assignment guidance in Chinese", async () => {
    await renderPicker(1, "zh");

    expect(container.textContent).toContain("预计预约时长");
    expect(container.textContent).toContain("价格均为澳元");
    expect(container.textContent).toContain("到店决定");
  });
});
