/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AttendanceFields from "./AttendanceFields";

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("AttendanceFields", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  async function renderFields(locale: "en" | "zh" = "en") {
    await act(async () => root.render(<AttendanceFields locale={locale} />));
  }

  function change(label: string, value: string) {
    const input = Array.from(
      container.querySelectorAll<HTMLInputElement>("input"),
    ).find((candidate) => candidate.labels?.[0]?.textContent?.includes(label));
    expect(input).not.toBeUndefined();
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
    input?.dispatchEvent(new Event("change", { bubbles: true }));
    return input;
  }

  it("counts DIY participants and accompanying adults toward the physical maximum of eight", async () => {
    await renderFields();

    await act(async () => {
      change("DIY participants", "7");
      change("Accompanying adults", "2");
    });

    expect(container.textContent).toContain("9 people in the studio");
    expect(container.textContent).toContain("maximum of 8 people");
    const adults = Array.from(
      container.querySelectorAll<HTMLInputElement>("input"),
    ).find((candidate) =>
      candidate.labels?.[0]?.textContent?.includes("Accompanying adults"),
    );
    expect(adults?.getAttribute("aria-invalid")).toBe("true");
    const errorId = adults?.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    expect(container.querySelector(`#${errorId}`)?.getAttribute("role")).toBe(
      "alert",
    );
  });

  it("requires an accompanying adult for any participant aged five through eight", async () => {
    await renderFields();

    await act(async () => {
      change("Children aged 5–8", "1");
      change("Accompanying adults", "0");
    });

    expect(container.textContent).toContain(
      "An accompanying adult is required when a child aged 5–8 attends.",
    );
  });

  it("keeps the supervision and minimum-age guidance equivalent in Chinese", async () => {
    await renderFields("zh");

    expect(container.textContent).toContain("最低年龄为 5 岁");
    expect(container.textContent).toContain("5 至 8 岁");
    expect(container.textContent).toContain("9 岁及以上");
  });
});
