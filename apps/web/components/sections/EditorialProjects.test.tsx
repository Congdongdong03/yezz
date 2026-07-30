import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import EditorialProjects from "./EditorialProjects";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) =>
    ({
      eyebrow: "Find your project",
      title: "Make something you will keep",
      viewAll: "Browse every project",
      noImage: "Image coming soon",
      duration: "Duration",
    })[key] ?? key,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => (
    <a className={className} href={href}>{children}</a>
  ),
}));

const projects = [
  {
    _id: "1",
    name: { en: "Cream craft", zh: "奶油胶" },
    slug: { current: "cream-craft" },
    imageUrl: "/cream.jpg",
    priceDisplay: "A$18",
    duration: "15–30 min",
  },
  {
    _id: "2",
    name: { en: "Beading", zh: "串珠" },
    slug: { current: "beading" },
  },
  {
    _id: "3",
    name: { en: "Clay figure", zh: "彩绘公仔" },
    slug: { current: "clay-figure" },
  },
];

describe("EditorialProjects", () => {
  it("gives the first of three projects the lead editorial position", () => {
    const html = renderToStaticMarkup(<EditorialProjects projects={projects} />);

    expect(html).toContain("Make something you will keep");
    expect(html).toContain("Cream craft");
    expect(html).toContain("lg:col-span-7");
    expect(html).toContain('href="/projects/cream-craft"');
  });
});
