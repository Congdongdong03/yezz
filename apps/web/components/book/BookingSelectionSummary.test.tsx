/** @vitest-environment jsdom */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BookingSelectionSummary from "./BookingSelectionSummary";

const projects = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: { en: "Beading", zh: "串珠" },
    category: {
      id: "beading",
      name: { en: "Beading", zh: "串珠" },
      slug: "beading",
    },
    durationMinutes: 30 as const,
    priceDisplay: "A$43",
    priceMinCents: 4300,
    priceMaxCents: 4300,
  },
];

describe("BookingSelectionSummary", () => {
  it("keeps project, people, time, price, and selected session visible", () => {
    const html = renderToStaticMarkup(
      <BookingSelectionSummary
        attendance={{
          participantCount: 2,
          youngChildCount: 0,
          accompanyingAdultCount: 1,
        }}
        date="2030-08-12"
        items={[
          {
            projectId: projects[0].id,
            quantity: 2,
            decideInStore: false,
          },
        ]}
        locale="en"
        projects={projects}
        startTime="10:30"
      />,
    );

    expect(html).toContain("Your request so far");
    expect(html).toContain("Beading × 2");
    expect(html).toContain("2 makers · 3 people attending");
    expect(html).toContain("30 minutes");
    expect(html).toContain("A$86.00");
    expect(html).toContain("2030-08-12 · 10:30");
  });

  it("uses an honest in-store price state when the project is undecided", () => {
    const html = renderToStaticMarkup(
      <BookingSelectionSummary
        attendance={{
          participantCount: 1,
          youngChildCount: 0,
          accompanyingAdultCount: 0,
        }}
        date=""
        items={[{ quantity: 1, decideInStore: true }]}
        locale="zh"
        projects={projects}
        startTime={null}
      />,
    );

    expect(html).toContain("到店决定 × 1");
    expect(html).toContain("到店选择后确定价格");
    expect(html).toContain("60 分钟");
  });
});
