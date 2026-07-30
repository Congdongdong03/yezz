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
});
