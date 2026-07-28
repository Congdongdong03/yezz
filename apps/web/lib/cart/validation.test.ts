import { describe, expect, it } from "vitest";
import { validateCartContact } from "./validation";

describe("validateCartContact", () => {
  it("uses English validation on the English page", () => {
    expect(validateCartContact({ name: "", phone: "" }, "en")).toEqual({
      name: ["Please enter your name"],
      phone: ["Please enter your phone number"],
    });
  });

  it("uses Chinese validation on the Chinese page", () => {
    expect(validateCartContact({ name: "", phone: "" }, "zh")).toEqual({
      name: ["请输入姓名"],
      phone: ["请输入电话"],
    });
  });

  it("rejects whitespace-only contact details", () => {
    expect(validateCartContact({ name: "  ", phone: "\t" }, "en")).toEqual({
      name: ["Please enter your name"],
      phone: ["Please enter your phone number"],
    });
  });

  it("accepts a name and phone number", () => {
    expect(validateCartContact({ name: "Izzy", phone: "0430 787 712" }, "en")).toEqual({});
  });
});
