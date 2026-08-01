/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("CatalogueBookingLink", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    window.dataLayer = [];
    window.gtag = vi.fn();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    vi.unstubAllEnvs();
  });

  it("navigates to the selected project and records booking intent", async () => {
    const { default: CatalogueBookingLink } = await import(
      "./CatalogueBookingLink"
    );
    await act(async () =>
      root.render(
        <CatalogueBookingLink
          locale="en"
          projectId="melty-project"
          projectName="Melty Bead Craft"
        />,
      ),
    );

    const link = container.querySelector<HTMLAnchorElement>("a");
    expect(link?.getAttribute("href")).toBe(
      "/en/book?project=melty-project",
    );
    expect(link?.getAttribute("aria-label")).toBe("Book Melty Bead Craft");

    link?.addEventListener("click", (event) => event.preventDefault());
    await act(async () =>
      link?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      ),
    );

    expect(window.gtag).toHaveBeenCalledWith("event", "begin_booking", {
      project_id: "melty-project",
      project_name: "Melty Bead Craft",
      source: "catalogue_detail",
    });
  });
});
