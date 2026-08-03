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
    category: {
      id: "beading",
      name: { en: "Beading", zh: "串珠" },
      slug: "beading",
    },
    durationMinutes: 30,
    priceDisplay: "A$43",
    priceMinCents: 4300,
    priceMaxCents: 4300,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: { en: "Paint clay figurine", zh: "彩绘黏土摆件" },
    category: {
      id: "paint",
      name: { en: "Paint", zh: "彩绘" },
      slug: "paint",
    },
    durationMinutes: 60,
    priceDisplay: "A$27.50",
    priceMinCents: 2750,
    priceMaxCents: 2750,
  },
];

const creamCategory = {
  id: "cream",
  name: { en: "Cream piping DIY", zh: "奶油胶DIY" },
  slug: "air-dry-cream-piping",
};

const creamProjects: OrdinaryBookingProject[] = [
  "Two hair clips",
  "Fridge magnet",
  "Mini drawers",
  "Hair claw",
  "Car decoration stand",
  "Medium storage box/drawers",
  "Pen holder, one face",
  "Phone case",
  "Small bag to decorate",
  "Future cream project",
].map((name, index) => ({
  id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  name: { en: name, zh: `项目 ${index + 1}` },
  category: creamCategory,
  durationMinutes: index < 5 ? 30 : 60,
  priceDisplay: `A$${index + 18}`,
  priceMinCents: (index + 18) * 100,
  priceMaxCents: (index + 18) * 100,
}));

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

  async function renderPicker(
    participantCount = 2,
    locale: "en" | "zh" = "en",
    showValidation = false,
    availableProjects = projects,
  ) {
    await act(async () =>
      root.render(
        <ProjectQuantityPicker
          locale={locale}
          onChange={(items) => {
            latest = items;
          }}
          participantCount={participantCount}
          projects={availableProjects}
          showValidation={showValidation}
        />,
      ),
    );
  }

  it("groups cream-piping choices and initially limits each group to popular projects", async () => {
    await renderPicker(1, "en", false, creamProjects);

    for (const heading of [
      "Quick & small",
      "Storage",
      "Home & office",
      "Phone accessories",
      "Medium & large",
      "More choices",
    ]) {
      expect(container.textContent).toContain(heading);
    }

    expect(
      container.querySelector('[aria-label="Mini drawers quantity"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Hair claw quantity"]'),
    ).toBeNull();

    const quickGroup = container.querySelector(
      '[data-project-group="quickSmall"]',
    );
    const toggle = quickGroup?.querySelector<HTMLButtonElement>("button");
    expect(toggle?.textContent).toContain("Show 2 more");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(toggle?.getAttribute("aria-controls")).toBe(
      quickGroup?.querySelector("[id]")?.id,
    );
  });

  it("keeps a selected project visible when its cream group is collapsed", async () => {
    await renderPicker(1, "en", false, creamProjects);

    const quickGroup = container.querySelector(
      '[data-project-group="quickSmall"]',
    );
    const toggle = quickGroup?.querySelector<HTMLButtonElement>("button");
    await act(async () => toggle?.click());
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");

    await act(async () => change("Hair claw quantity", "1"));
    await act(async () => toggle?.click());

    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(
      container.querySelector('[aria-label="Hair claw quantity"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Car decoration stand quantity"]'),
    ).toBeNull();
  });

  it("places future cream-piping projects in More choices instead of dropping them", async () => {
    await renderPicker(1, "en", false, creamProjects);

    const moreChoices = container.querySelector(
      '[data-project-group="moreChoices"]',
    );
    expect(moreChoices?.textContent).toContain("Future cream project");
  });

  it("shows only the active category and changes categories without listing every project", async () => {
    await renderPicker(1);

    expect(container.textContent).toContain("Beading");
    expect(container.textContent).not.toContain("Paint clay figurine");

    const paintCategory = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent === "Paint");
    await act(async () => paintCategory?.click());

    expect(container.textContent).not.toContain("Beading quantity");
    expect(container.textContent).toContain("Paint clay figurine");
  });

  it("does not announce a selection error until the customer interacts or continues", async () => {
    await renderPicker(1);

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain("Choose a project to continue");

    await renderPicker(1, "en", true);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "Choose exactly one project",
    );
  });

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

  async function chooseCategory(label: string) {
    const button = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((candidate) => candidate.textContent === label);
    expect(button).not.toBeUndefined();
    await act(async () => button?.click());
  }

  it("uses the longest selected project and requires one project quantity per participant", async () => {
    await renderPicker();

    await act(async () => {
      change("Beading quantity", "1");
    });
    await chooseCategory("Paint");
    await act(async () => change("Paint clay figurine quantity", "1"));

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

  it("keeps both project choices when quantities change before React rerenders", async () => {
    const delayedControlledValue: OrdinaryBookingItemSelection[] = [];
    const sameCategoryProjects = [
      projects[0],
      {
        ...projects[1],
        category: projects[0].category,
      },
    ];

    await act(async () =>
      root.render(
        <ProjectQuantityPicker
          locale="en"
          onChange={(items) => {
            latest = items;
          }}
          participantCount={2}
          projects={sameCategoryProjects}
          value={delayedControlledValue}
        />,
      ),
    );

    await act(async () => {
      change("Beading quantity", "1");
      change("Paint clay figurine quantity", "1");
    });

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
    expect(latest).toEqual([{ quantity: 1, decideInStore: true }]);
  });

  it("keeps Decide in store separate from named project choices", async () => {
    await renderPicker(1);

    await act(async () => change("Beading quantity", "1"));
    await act(async () => change("Decide in store quantity", "1"));

    expect(latest).toEqual([{ quantity: 1, decideInStore: true }]);
    expect(
      container.querySelector<HTMLInputElement>(
        '[aria-label="Beading quantity"]',
      )?.value,
    ).toBe("0");
  });

  it("exposes thumb-sized semantic quantity controls and a linked parity error", async () => {
    await renderPicker(2, "en", true);

    const inputs = container.querySelectorAll<HTMLInputElement>(
      'input[type="number"]',
    );
    expect(inputs.length).toBe(2);
    for (const input of inputs) {
      expect(input.min).toBe("0");
      expect(input.inputMode).toBe("numeric");
      expect(input.className).toContain("min-h-11");
    }

    expect(container.textContent).toContain(
      "Choose exactly one project for each DIY participant",
    );
    expect(
      container
        .querySelector('[data-testid="project-parity-error"]')
        ?.getAttribute("role"),
    ).toBe("alert");
  });

  it("provides equivalent duration, price, and assignment guidance in Chinese", async () => {
    await renderPicker(1, "zh");

    expect(container.textContent).toContain("预计预约时长");
    expect(container.textContent).toContain("价格均为澳元");
    expect(container.textContent).toContain("到店决定");
  });
});
