import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import BookingForm from "./BookingForm";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

describe("BookingForm capability fallback", () => {
  it("shows phone and email contact instead of a disabled experience form", () => {
    const html = renderToStaticMarkup(
      <BookingForm requestEnabled={false} />,
    );

    expect(html).toContain('href="tel:0430787712"');
    expect(html).toContain(
      'href="mailto:congdongdong03@gmail.com"',
    );
    expect(html).not.toContain("<form");
  });
});
