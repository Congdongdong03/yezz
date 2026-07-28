export const YEZYY_BUSINESS_PROFILE = {
  storeName: "YezYY",
  website: "https://yezyy.com",
  address: "G082/235 Springvale Rd, Glen Waverley VIC 3150",
  phone: "0430 787 712",
  email: "izzybella.chen@gmail.com",
  xiaohongshu: "95848743904",
  currency: "AUD",
  googleMapUrl:
    "https://www.google.com/maps/search/?api=1&query=G082%2F235%20Springvale%20Rd%2C%20Glen%20Waverley%20VIC%203150",
} as const;

const BUSINESS_HOURS = {
  en: [
    "Monday: 9:30 am–5:00 pm",
    "Tuesday: 9:30 am–5:00 pm",
    "Wednesday: 9:30 am–5:00 pm",
    "Thursday: 9:30 am–8:30 pm",
    "Friday: 9:30 am–8:30 pm",
    "Saturday: 9:30 am–5:30 pm",
    "Sunday: 10:00 am–5:00 pm",
  ],
  zh: [
    "星期一：上午9:30–下午5:00",
    "星期二：上午9:30–下午5:00",
    "星期三：上午9:30–下午5:00",
    "星期四：上午9:30–晚上8:30",
    "星期五：上午9:30–晚上8:30",
    "星期六：上午9:30–下午5:30",
    "星期日：上午10:00–下午5:00",
  ],
} as const;

export function formatPhoneHref(phone: string) {
  return phone.replace(/\D/g, "");
}

export function formatBusinessHours(locale: "en" | "zh"): string {
  return BUSINESS_HOURS[locale].join("; ");
}
