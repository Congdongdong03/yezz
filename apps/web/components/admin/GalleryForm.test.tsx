import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import GalleryForm from "./GalleryForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("GalleryForm", () => {
  it("shows clear Chinese labels for every studio media role", () => {
    const html = renderToStaticMarkup(<GalleryForm />);

    expect(html).toContain("门店环境");
    expect(html).toContain("门店入口与到店指引");
    expect(html).toContain("制作过程");
    expect(html).toContain("派对场景");
    expect(html).toContain("已授权顾客作品");
    expect(html).toContain("作品展示（旧分类）");
  });
});
