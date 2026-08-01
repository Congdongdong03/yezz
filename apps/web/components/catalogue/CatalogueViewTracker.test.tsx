/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("CatalogueViewTracker", () => {
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

  it("records one project view when a catalogue detail mounts", async () => {
    const { default: CatalogueViewTracker } = await import(
      "./CatalogueViewTracker"
    );

    await act(async () =>
      root.render(
        <CatalogueViewTracker
          projectName="Melty Beads"
          projectSlug="melty-beads"
        />,
      ),
    );

    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith("event", "view_project", {
      project_slug: "melty-beads",
      project_name: "Melty Beads",
    });
  });
});
