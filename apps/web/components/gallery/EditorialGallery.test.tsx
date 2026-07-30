import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EditorialGallery from "./EditorialGallery";

describe("EditorialGallery", () => {
  it("separates verified store images from generic inspiration", () => {
    const html = renderToStaticMarkup(
      <EditorialGallery
        locale="en"
        images={[
          {
            _id: "store-1",
            imageUrl: "/store.jpg",
            category: "store",
            caption: { en: "YezYY shop floor", zh: "YezYY 店内" },
          },
        ]}
      />,
    );

    expect(html).toContain("At YezYY");
    expect(html).toContain("DIY inspiration");
    expect(html).toContain("Community moments");
  });

  it("keeps customer work empty until there is consented material", () => {
    const html = renderToStaticMarkup(<EditorialGallery locale="en" images={[]} />);

    expect(html).toContain("Customer moments will appear here");
  });
});
