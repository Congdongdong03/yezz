import { describe, expect, it } from "vitest";
import {
  YEZYY_BUSINESS_PROFILE,
  formatBusinessHours,
  formatPhoneHref,
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
});
