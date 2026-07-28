/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CartDrawer from "./CartDrawer";

let isOpen = true;
let locale = "en";
const setIsOpen = vi.fn((next: boolean) => {
  isOpen = next;
});
const removeItem = vi.fn();

vi.mock("next-intl", () => ({
  useLocale: () => locale,
  useTranslations: () => (key: string) =>
    ({
      title: locale === "zh" ? "我的预选单" : "My pre-selection",
      close: locale === "zh" ? "关闭购物车" : "Close cart",
      removeItem: locale === "zh" ? "移除" : "Remove",
      people: locale === "zh" ? "人" : "people",
      goToCart: "Go to cart",
      empty: "Empty",
    })[key] ?? key,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({
    children,
    href,
    onClick,
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/cart/context", () => ({
  useCart: () => ({
    isOpen,
    setIsOpen,
    removeItem,
    items: [
      {
        projectId: "project-1",
        projectName: { en: "Clay figurine", zh: "彩绘公仔" },
        projectType: "product",
      },
    ],
  }),
}));

const testEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("CartDrawer accessibility", () => {
  let container: HTMLDivElement;
  let opener: HTMLButtonElement;
  let root: Root;

  beforeEach(() => {
    isOpen = true;
    locale = "en";
    setIsOpen.mockClear();
    removeItem.mockClear();
    opener = document.createElement("button");
    opener.textContent = "Open cart";
    document.body.append(opener);
    opener.focus();
    container = document.createElement("div");
    container.id = "app";
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  async function renderDrawer() {
    await act(async () => root.render(<CartDrawer />));
  }

  it("uses a labelled modal dialog, focuses it, and isolates the page behind it", async () => {
    await renderDrawer();

    const dialog = document.querySelector<HTMLElement>("[role='dialog']");
    const title = document.querySelector<HTMLElement>("h2");

    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-labelledby")).toBe(title?.id);
    expect(document.activeElement).toBe(dialog?.querySelector("button"));
    expect(container.hasAttribute("inert")).toBe(true);

    opener.focus();
    expect(document.activeElement).toBe(dialog?.querySelector("button"));
  });

  it("traps Tab in both directions and closes on Escape", async () => {
    await renderDrawer();
    const dialog = document.querySelector<HTMLElement>("[role='dialog']");
    const focusables = Array.from(
      dialog?.querySelectorAll<HTMLElement>("button, a[href]") ?? [],
    );
    const first = focusables[0];
    const last = focusables.at(-1);

    last?.focus();
    dialog?.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Tab",
      }),
    );
    expect(document.activeElement).toBe(first);

    first?.focus();
    dialog?.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Tab",
        shiftKey: true,
      }),
    );
    expect(document.activeElement).toBe(last);

    dialog?.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Escape",
      }),
    );
    expect(setIsOpen).toHaveBeenCalledWith(false);
  });

  it("restores focus to the exact opener after closing", async () => {
    await renderDrawer();
    isOpen = false;
    await renderDrawer();

    expect(document.querySelector("[role='dialog']")).toBeNull();
    expect(container.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it("gives every removal button a localized name that identifies its item", async () => {
    await renderDrawer();
    expect(
      document.querySelector("button[aria-label='Remove Clay figurine']"),
    ).not.toBeNull();

    locale = "zh";
    await renderDrawer();
    expect(
      document.querySelector("button[aria-label='移除 彩绘公仔']"),
    ).not.toBeNull();
  });
});
