import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ProjectDetail from "./ProjectDetail";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/cart/context", () => ({
  useCart: () => ({
    addItem: vi.fn(),
    setIsOpen: vi.fn(),
  }),
}));

vi.mock("@/components/book/BookingCalendar", () => ({
  default: () => <div data-testid="calendar" />,
}));

vi.mock("@/components/book/BookingForm", () => ({
  default: () => <form data-testid="booking-form" />,
}));

vi.mock("./StyleSelector", () => ({
  default: () => <div data-testid="style-selector" />,
}));

describe("ProjectDetail capability fallback", () => {
  it("does not render product request controls when product requests are disabled", () => {
    const html = renderToStaticMarkup(
      <ProjectDetail
        locale="en"
        requestEnabled={false}
        project={{
          _id: "product-1",
          name: { en: "Phone Case", zh: "手机壳" },
          projectType: "product",
          styles: [
            {
              _id: "style-1",
              name: { en: "Pink", zh: "粉色" },
            },
          ],
        }}
      />,
    );

    expect(html).toContain('href="tel:0430787712"');
    expect(html).toContain('href="mailto:congdongdong03@gmail.com"');
    expect(html).not.toContain('data-testid="style-selector"');
    expect(html).not.toContain(">add<");
  });

  it("sends enabled experience visitors to the current ordinary booking flow", () => {
    const html = renderToStaticMarkup(
      <ProjectDetail
        locale="en"
        requestEnabled
        project={{
          _id: "experience-1",
          name: { en: "Clay Cup", zh: "陶杯" },
          projectType: "experience",
          category: { _id: "category-1" },
        }}
      />,
    );

    expect(html).toContain('href="/book"');
    expect(html).toContain("bookCurrentFlow");
    expect(html).not.toContain('data-testid="calendar"');
    expect(html).not.toContain('data-testid="booking-form"');
  });
});
