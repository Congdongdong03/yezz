import { describe, expect, it } from "vitest";
import {
  YEZYY_BUSINESS_PROFILE,
  formatBusinessHours,
  formatPhoneHref,
  filterPublishableGalleryImages,
  getEmptyCatalogueCopy,
  sanitizePublicWeChatId,
} from "./business";

describe("YezYY business profile", () => {
  it("contains the approved public identity", () => {
    expect(YEZYY_BUSINESS_PROFILE).toMatchObject({
      storeName: "YezYY",
      address: "G082/235 Springvale Rd, Glen Waverley VIC 3150",
      phone: "0430 787 712",
      email: "izzybella.chen@gmail.com",
      xiaohongshu: "95848743904",
      currency: "AUD",
    });
  });

  it("creates a dialable Australian phone link", () => {
    expect(formatPhoneHref("0430 787 712")).toBe("0430787712");
  });

  it("formats the confirmed Thursday closing time", () => {
    expect(formatBusinessHours("en")).toContain("Thursday: 9:30 am–8:30 pm");
    expect(formatBusinessHours("zh")).toContain("星期四：上午9:30–晚上8:30");
  });

  it("explains that an empty project catalogue is being prepared", () => {
    expect(getEmptyCatalogueCopy("en", "projects")).toEqual({
      title: "Our project menu is being prepared",
      body: "YezYY is open. Call or email us to ask about current DIY experiences.",
    });
  });

  it("uses the approved Chinese gallery empty-state title", () => {
    expect(getEmptyCatalogueCopy("zh", "gallery").title).toBe("作品照片正在整理中");
  });

  it.each([undefined, null, "", "   ", "yezz_studio", "YEZZ_STUDIO", "your_wechat_id"])(
    "hides an absent or legacy public WeChat ID (%s)",
    (wechatId) => {
      expect(sanitizePublicWeChatId(wechatId)).toBeUndefined();
    },
  );

  it("preserves a configured public WeChat ID", () => {
    expect(sanitizePublicWeChatId("  real_contact_id  ")).toBe("real_contact_id");
  });

  it("keeps only gallery records with a publishable image URL", () => {
    const records = [
      { _id: "missing" },
      { _id: "blank", imageUrl: "  " },
      { _id: "published", imageUrl: "https://example.com/work.jpg" },
    ];

    expect(filterPublishableGalleryImages(records)).toEqual([records[2]]);
  });
});
