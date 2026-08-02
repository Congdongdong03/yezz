import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EditorialGallery from "./EditorialGallery";

describe("EditorialGallery", () => {
  it("separates real studio, process, party, and consented community images", () => {
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
          {
            _id: "process-1",
            imageUrl: "/process.jpg",
            category: "process",
            caption: { en: "Decorating together", zh: "一起制作" },
          },
          {
            _id: "party-1",
            imageUrl: "/party.jpg",
            category: "party",
            caption: { en: "Party table", zh: "派对桌面" },
          },
          {
            _id: "community-1",
            imageUrl: "/community.jpg",
            category: "community",
            caption: { en: "Shared with permission", zh: "已获授权分享" },
          },
        ]}
      />,
    );

    expect(html).toContain("At YezYY");
    expect(html).toContain("See how it comes together");
    expect(html).toContain("A party made by hand");
    expect(html).toContain("DIY inspiration");
    expect(html).toContain("Community moments");
    expect(html).toContain('alt="Decorating together"');
    expect(html).toContain('alt="Party table"');
    expect(html).toContain('alt="Shared with permission"');
  });

  it("keeps customer work empty until there is consented material", () => {
    const html = renderToStaticMarkup(<EditorialGallery locale="en" images={[]} />);

    expect(html).toContain("Customer moments will appear here");
    expect(html).toContain("Making photos are coming soon");
    expect(html).toContain("Party photos are coming soon");
    expect(html).not.toContain('alt="Shared with permission"');
  });

  it("renders the studio diary headings in Chinese", () => {
    const html = renderToStaticMarkup(<EditorialGallery locale="zh" images={[]} />);

    expect(html).toContain("看看作品如何完成");
    expect(html).toContain("亲手完成的派对");
    expect(html).toContain("取得分享许可后");
  });
});
