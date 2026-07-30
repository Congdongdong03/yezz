import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ImageProvenance from "./ImageProvenance";

describe("ImageProvenance", () => {
  it("does not describe inspiration as YezYY customer work", () => {
    const html = renderToStaticMarkup(
      <ImageProvenance
        locale="en"
        kind="inspiration"
        sourceUrl="https://unsplash.com/s/photos/beaded-bracelet"
        licenseUrl="https://unsplash.com/license"
      />,
    );

    expect(html).toContain("DIY inspiration");
    expect(html).toContain("Source");
    expect(html).not.toContain("YezYY customer work");
  });

  it("uses the Chinese disclosure when requested", () => {
    const html = renderToStaticMarkup(
      <ImageProvenance
        locale="zh"
        kind="inspiration"
        sourceUrl="https://unsplash.com/s/photos/beaded-bracelet"
        licenseUrl="https://unsplash.com/license"
      />,
    );

    expect(html).toContain("DIY 灵感图");
    expect(html).toContain("来源");
  });
});
