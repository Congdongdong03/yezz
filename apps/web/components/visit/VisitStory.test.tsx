import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import VisitStory from "./VisitStory";

describe("VisitStory", () => {
  it("renders the exact studio address, hours, and map action", () => {
    const html = renderToStaticMarkup(
      <VisitStory locale="en" settings={null} storeImage={null} />,
    );

    expect(html).toContain("G082/235 Springvale Rd, Glen Waverley VIC 3150");
    expect(html).toContain("Open in Google Maps");
    expect(html).toContain("Tue");
  });

  it("shows an arrival photo and explains confirmation and in-store payment", () => {
    const html = renderToStaticMarkup(
      <VisitStory
        locale="en"
        settings={null}
        storeImage={null}
        arrivalImage={{
          _id: "arrival-1",
          imageUrl: "/arrival.jpg",
          caption: { en: "YezYY storefront" },
        }}
      />,
    );

    expect(html).toContain('alt="YezYY storefront"');
    expect(html).toContain("Before you arrive");
    expect(html).toContain("wait for a staff confirmation");
    expect(html).toContain("Ordinary DIY sessions are paid in store");
    expect(html).toContain("separate visit before the party date");
  });

  it("uses honest arrival guidance when a close entrance photo is not available", () => {
    const html = renderToStaticMarkup(
      <VisitStory locale="zh" settings={null} storeImage={null} arrivalImage={null} />,
    );

    expect(html).toContain("近距离入口照片即将补充");
    expect(html).toContain("以店员确认结果为准");
  });
});
