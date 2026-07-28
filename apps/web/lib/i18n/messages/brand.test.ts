import { describe, expect, it } from "vitest";
import enMessages from "./en.json";
import zhMessages from "./zh.json";

describe("customer-visible brand messages", () => {
  it.each([
    [
      "English",
      enMessages,
      "A warm, inviting space designed for creativity and connection. Come experience the YezYY atmosphere.",
      "Get in touch with YezYY DIY Studio in Glen Waverley — visit us or book your experience.",
      "Email: congdongdong03@gmail.com",
    ],
    [
      "Chinese",
      zhMessages,
      "一个温暖、舒适的空间，专为创意和连接而设计。来体验 YezYY 的氛围吧。",
      "联系 Glen Waverley 的 YezYY 手作体验馆——到店体验或预约活动。",
      "邮箱：congdongdong03@gmail.com",
    ],
  ])(
    "uses the canonical identity in %s active copy",
    (_locale, messages, expectedStoreCopy, expectedContactCopy, expectedEmail) => {
      expect(messages.home.storeVibes.desc).toBe(expectedStoreCopy);
      expect(messages.contact.metaDescription).toBe(expectedContactCopy);
      expect(messages.footer.email).toBe(expectedEmail);
    },
  );
});
