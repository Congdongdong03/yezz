import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import StudioProcess from "./StudioProcess";

describe("StudioProcess", () => {
  it("discloses generic process imagery as inspiration", () => {
    const html = renderToStaticMarkup(<StudioProcess locale="en" />);

    expect(html).toContain("DIY inspiration");
    expect(html).toContain("Choose a project");
    expect(html).toContain("Make it yours");
  });
});
