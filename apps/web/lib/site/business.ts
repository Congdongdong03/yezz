export const YEZYY_BUSINESS_PROFILE = {
  storeName: "YezYY",
  website: "https://yezyy.com",
  address: "G082/235 Springvale Rd, Glen Waverley VIC 3150",
  phone: "0430 787 712",
  email: "congdongdong03@gmail.com",
  abn: process.env.NEXT_PUBLIC_YEZYY_ABN?.trim() || null,
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

type CatalogueKind = "projects" | "parties" | "gallery";

const EMPTY_CATALOGUE_COPY: Record<
  "en" | "zh",
  Record<
    CatalogueKind,
    {
  title: string;
  body: string;
    }
  >
> = {
  en: {
    projects: {
      title: "Our project menu is being prepared",
      body: "YezYY is open. Call or email us to ask about current DIY experiences.",
    },
    parties: {
      title: "Our party options are being prepared",
      body: "YezYY is open. Call or email us to plan a celebration at the studio.",
    },
    gallery: {
      title: "Customer creations are being curated",
      body: "YezYY is open. Call or email us to ask about current DIY experiences.",
    },
  },
  zh: {
    projects: {
      title: "手作项目正在整理中",
      body: "YezYY 已经开业。欢迎致电或发送邮件咨询目前可体验的手作项目。",
    },
    parties: {
      title: "派对方案正在整理中",
      body: "YezYY 已经开业。欢迎致电或发送邮件，为您的庆祝活动咨询安排。",
    },
    gallery: {
      title: "作品照片正在整理中",
      body: "YezYY 已经开业。欢迎致电或发送邮件咨询目前可体验的手作项目。",
    },
  },
};

export function getEmptyCatalogueCopy(
  locale: "en" | "zh",
  kind: CatalogueKind,
) {
  return EMPTY_CATALOGUE_COPY[locale][kind];
}

const PUBLIC_WECHAT_PLACEHOLDERS = new Set([
  "yezz_studio",
  "your_wechat_id",
  "wechat_id",
]);

export function sanitizePublicWeChatId(value: string | null | undefined) {
  const wechatId = value?.trim();
  if (!wechatId || PUBLIC_WECHAT_PLACEHOLDERS.has(wechatId.toLowerCase())) {
    return undefined;
  }
  return wechatId;
}

export function filterPublishableGalleryImages<T extends { imageUrl?: string }>(
  images: T[],
) {
  return images.filter((image) => Boolean(image.imageUrl?.trim()));
}
