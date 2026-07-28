type CartContact = {
  name: string;
  phone: string;
};

type CartLocale = "en" | "zh";

const requiredMessages: Record<CartLocale, Record<keyof CartContact, string>> = {
  en: {
    name: "Please enter your name",
    phone: "Please enter your phone number",
  },
  zh: {
    name: "请输入姓名",
    phone: "请输入电话",
  },
};

export function validateCartContact(
  contact: CartContact,
  locale: CartLocale,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  if (!contact.name.trim()) {
    errors.name = [requiredMessages[locale].name];
  }
  if (!contact.phone.trim()) {
    errors.phone = [requiredMessages[locale].phone];
  }

  return errors;
}
