/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookingStatusDialog from "./BookingStatusDialog";

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("BookingStatusDialog", () => {
  let container: HTMLDivElement;
  let opener: HTMLButtonElement;
  let root: Root;

  beforeEach(() => {
    opener = document.createElement("button");
    opener.textContent = "更改状态";
    document.body.append(opener);
    opener.focus();

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  async function renderDialog(
    props: Partial<React.ComponentProps<typeof BookingStatusDialog>> = {},
  ) {
    await act(async () => {
      root.render(
        <BookingStatusDialog
          expectedStatus="new"
          onCancel={vi.fn()}
          onConfirm={vi.fn().mockResolvedValue(undefined)}
          open
          status="confirmed"
          {...props}
        />,
      );
    });
  }

  it("moves focus into the dialog and restores the opener when it closes", async () => {
    await renderDialog();

    expect(document.activeElement).toBe(container.querySelector("textarea"));

    await act(async () => root.unmount());
    expect(document.activeElement).toBe(opener);
  });

  it("keeps Tab navigation inside the dialog", async () => {
    await renderDialog();
    const dialog = container.querySelector<HTMLElement>("[role='dialog']");
    const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
    const confirmButton = buttons.at(-1);

    expect(dialog).not.toBeNull();
    expect(textarea).not.toBeNull();
    expect(confirmButton).toBeDefined();

    confirmButton?.focus();
    dialog?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
    expect(document.activeElement).toBe(textarea);

    dialog?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Tab", shiftKey: true }),
    );
    expect(document.activeElement).toBe(confirmButton);
  });

  it("closes on Escape unless a submission is in progress", async () => {
    const onCancel = vi.fn();
    await renderDialog({ onCancel });
    const dialog = container.querySelector<HTMLElement>("[role='dialog']");

    dialog?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    expect(onCancel).toHaveBeenCalledOnce();

    await renderDialog({ isSubmitting: true, onCancel });
    dialog?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("keeps a focus target inside the dialog when submission starts", async () => {
    await renderDialog();
    const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
    const confirmButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).at(-1);

    expect(document.activeElement).toBe(textarea);
    confirmButton?.focus();
    expect(document.activeElement).toBe(confirmButton);

    await renderDialog({ isSubmitting: true });
    const dialog = container.querySelector<HTMLElement>("[role='dialog']");
    const tabEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Tab",
    });
    dialog?.dispatchEvent(tabEvent);

    expect(textarea?.disabled).toBe(false);
    expect(textarea?.readOnly).toBe(true);
    expect(document.activeElement).toBe(textarea);
    expect(dialog?.contains(document.activeElement)).toBe(true);
    expect(tabEvent.defaultPrevented).toBe(true);
  });

  it("keeps the note and reports the error when submission fails", async () => {
    await renderDialog({ onConfirm: vi.fn().mockRejectedValue(new Error("网络连接失败")) });
    const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
    const confirmButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).at(-1);

    expect(textarea).not.toBeNull();
    expect(confirmButton).toBeDefined();

    await act(async () => {
      if (!textarea) return;
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setValue?.call(textarea, "请改约到星期日");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => confirmButton?.click());

    expect(container.textContent).toContain("状态更新失败，请重试");
    expect(container.textContent).not.toContain("网络连接失败");
    expect(textarea?.value).toBe("请改约到星期日");
    expect(container.querySelector("[role='dialog']")).not.toBeNull();
  });

  it("retains one operation ID and expected status across a network retry", async () => {
    const onConfirm = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);
    await renderDialog({
      expectedStatus: "contacted",
      onConfirm,
      status: "confirmed",
    });
    const confirmButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).at(-1);

    await act(async () => confirmButton?.click());
    await act(async () => confirmButton?.click());

    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(onConfirm.mock.calls[0]?.[0]).toMatchObject({
      expectedStatus: "contacted",
      status: "confirmed",
    });
    expect(onConfirm.mock.calls[1]?.[0].operationId).toBe(
      onConfirm.mock.calls[0]?.[0].operationId,
    );
    expect(onConfirm.mock.calls[0]?.[0].operationId).toMatch(
      /^[0-9a-f-]{36}$/i,
    );
  });

  it("offers an accessible confirmation for the contacted transition", async () => {
    await renderDialog({
      expectedStatus: "new",
      status: "contacted",
    });

    expect(container.querySelector("[role='dialog']")).not.toBeNull();
    expect(container.textContent).toContain("标记为已联系");
  });
});
