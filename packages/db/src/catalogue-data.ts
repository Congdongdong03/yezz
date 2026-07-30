import type { LocalizedString } from "./schema/index.js";
import type { LiveCategorySlug } from "./live-booking-catalogue.js";

export type PublicCatalogueSeed = {
  categorySlug: LiveCategorySlug;
  slug: string;
  name: LocalizedString;
  description: LocalizedString;
  durationDisplay: LocalizedString;
  occasionTags: LocalizedString[];
  projectSlugs: string[];
  published: true;
  featured: boolean;
  sortOrder: number;
  image: {
    coverImageUrl: string;
    imageKind: "inspiration";
    sourceUrl: string;
    licenseUrl: string;
    attribution: string;
  };
};

const UNSPLASH_LICENSE_URL = "https://unsplash.com/license";

const CRAFT_MATERIALS_IMAGE = {
  coverImageUrl:
    "https://images.unsplash.com/photo-1638829154930-9b47ff9cb533?auto=format&fit=crop&w=1600&q=84",
  imageKind: "inspiration" as const,
  sourceUrl:
    "https://unsplash.com/photos/a-table-topped-with-lots-of-craft-supplies-K_BpdS338z4",
  licenseUrl: UNSPLASH_LICENSE_URL,
  attribution: "Unsplash",
};

const CERAMIC_DECORATING_IMAGE = {
  coverImageUrl:
    "https://images.unsplash.com/photo-1673339065013-f8411fb93848?auto=format&fit=crop&w=1600&q=84",
  imageKind: "inspiration" as const,
  sourceUrl:
    "https://unsplash.com/photos/a-person-painting-a-bowl-with-a-brush-ZgO_ohK2V6A",
  licenseUrl: UNSPLASH_LICENSE_URL,
  attribution: "Unsplash",
};

const BEADING_IMAGE = {
  coverImageUrl:
    "https://images.unsplash.com/photo-1519431458145-1ca3d5ccd68e?auto=format&fit=crop&w=1600&q=84",
  imageKind: "inspiration" as const,
  sourceUrl:
    "https://unsplash.com/photos/beaded-assorted-accessories-in-case-NnD1jMzybbE",
  licenseUrl: UNSPLASH_LICENSE_URL,
  attribution: "Unsplash",
};

const DATE_IDEA = { en: "Date idea", zh: "约会体验" };
const FAMILY_ACTIVITY = { en: "Family activity", zh: "亲子活动" };
const FRIENDS_DAY_OUT = { en: "Friends day out", zh: "朋友聚会" };
const HANDMADE_GIFT = { en: "Handmade gift", zh: "手作礼物" };
const BIRTHDAY_ACTIVITY = { en: "Birthday activity", zh: "生日体验" };
const RELAXING_CRAFT = { en: "Relaxing craft", zh: "放松手作" };

export const PUBLIC_CATALOGUE_ENTRIES = [
  {
    categorySlug: "air-dry-cream-piping",
    slug: "deco-cream-two-hair-clips",
    name: { en: "Two Hair Clips", zh: "一对发夹" },
    description: {
      en: "Decorate a pair of hair clips with cream piping.",
      zh: "用奶油胶装饰一对发夹。",
    },
    durationDisplay: { en: "15–30 min", zh: "15–30 分钟" },
    occasionTags: [FRIENDS_DAY_OUT, HANDMADE_GIFT],
    projectSlugs: ["air-dry-two-hair-clips"],
    published: true,
    featured: true,
    sortOrder: 0,
    image: CRAFT_MATERIALS_IMAGE,
  },
  {
    categorySlug: "air-dry-cream-piping",
    slug: "deco-cream-mini-drawers",
    name: { en: "Mini Drawers", zh: "迷你抽屉" },
    description: {
      en: "Decorate mini drawers with cream piping.",
      zh: "用奶油胶装饰迷你抽屉。",
    },
    durationDisplay: { en: "15–30 min", zh: "15–30 分钟" },
    occasionTags: [DATE_IDEA, HANDMADE_GIFT],
    projectSlugs: ["air-dry-mini-drawers"],
    published: true,
    featured: true,
    sortOrder: 1,
    image: CRAFT_MATERIALS_IMAGE,
  },
  {
    categorySlug: "air-dry-cream-piping",
    slug: "deco-cream-phone-case",
    name: { en: "Phone Case", zh: "手机壳" },
    description: {
      en: "Decorate an available phone case base with cream piping.",
      zh: "用奶油胶装饰店内可选的手机壳底座。",
    },
    durationDisplay: { en: "30–45 min", zh: "30–45 分钟" },
    occasionTags: [DATE_IDEA, FRIENDS_DAY_OUT, HANDMADE_GIFT],
    projectSlugs: ["air-dry-phone-case"],
    published: true,
    featured: true,
    sortOrder: 2,
    image: CRAFT_MATERIALS_IMAGE,
  },
  {
    categorySlug: "air-dry-cream-piping",
    slug: "deco-cream-lamp",
    name: { en: "Lamp", zh: "台灯" },
    description: {
      en: "Decorate an available lamp base with cream piping.",
      zh: "用奶油胶装饰店内可选的台灯底座。",
    },
    durationDisplay: { en: "30–45 min", zh: "30–45 分钟" },
    occasionTags: [DATE_IDEA, BIRTHDAY_ACTIVITY, RELAXING_CRAFT],
    projectSlugs: ["air-dry-lamp"],
    published: true,
    featured: true,
    sortOrder: 3,
    image: CRAFT_MATERIALS_IMAGE,
  },
  {
    categorySlug: "air-dry-cream-piping",
    slug: "deco-cream-medium-storage",
    name: { en: "Medium Storage Box", zh: "中号收纳盒" },
    description: {
      en: "Decorate a medium storage box with cream piping.",
      zh: "用奶油胶装饰中号收纳盒。",
    },
    durationDisplay: { en: "30–45 min", zh: "30–45 分钟" },
    occasionTags: [FAMILY_ACTIVITY, HANDMADE_GIFT],
    projectSlugs: ["air-dry-medium-storage"],
    published: true,
    featured: false,
    sortOrder: 4,
    image: CRAFT_MATERIALS_IMAGE,
  },
  {
    categorySlug: "air-dry-cream-piping",
    slug: "deco-cream-large-storage",
    name: { en: "Large Storage Box", zh: "大号收纳盒" },
    description: {
      en: "Decorate a large storage box with cream piping.",
      zh: "用奶油胶装饰大号收纳盒。",
    },
    durationDisplay: { en: "30–45 min", zh: "30–45 分钟" },
    occasionTags: [FAMILY_ACTIVITY, BIRTHDAY_ACTIVITY, RELAXING_CRAFT],
    projectSlugs: ["air-dry-large-storage"],
    published: true,
    featured: false,
    sortOrder: 5,
    image: CRAFT_MATERIALS_IMAGE,
  },
  {
    categorySlug: "paint-clay",
    slug: "plaster-painting",
    name: { en: "Plaster Painting", zh: "石膏彩绘" },
    description: {
      en: "Paint an available plaster figurine design in store.",
      zh: "在店内为可选的石膏摆件款式上色。",
    },
    durationDisplay: { en: "About 1 hour", zh: "约 1 小时" },
    occasionTags: [FAMILY_ACTIVITY, FRIENDS_DAY_OUT, BIRTHDAY_ACTIVITY],
    projectSlugs: [
      "paint-clay-figurine-mini",
      "paint-clay-figurine-small",
      "paint-clay-figurine-medium",
      "paint-clay-figurine-large",
    ],
    published: true,
    featured: true,
    sortOrder: 0,
    image: CERAMIC_DECORATING_IMAGE,
  },
  {
    categorySlug: "beading",
    slug: "beading",
    name: { en: "Beading", zh: "串珠" },
    description: {
      en: "Make a bracelet, phone strap, or bag chain with available beads and charms.",
      zh: "使用店内可选的串珠和挂件制作手链、手机链或包链。",
    },
    durationDisplay: { en: "About 30 min", zh: "约 30 分钟" },
    occasionTags: [DATE_IDEA, FRIENDS_DAY_OUT, HANDMADE_GIFT],
    projectSlugs: ["beading"],
    published: true,
    featured: true,
    sortOrder: 0,
    image: BEADING_IMAGE,
  },
  {
    categorySlug: "melty-beads",
    slug: "melty-beads",
    name: { en: "Melty Beads", zh: "拼豆" },
    description: {
      en: "Make a small or large melty-bead design; detailed designs can take longer and are completed in one session.",
      zh: "制作小型或大型拼豆图案；细节较多的图案可能需要更久，并需在同一节体验中完成。",
    },
    durationDisplay: {
      en: "1 hour; extra time available",
      zh: "1 小时；可加时",
    },
    occasionTags: [FAMILY_ACTIVITY, FRIENDS_DAY_OUT, RELAXING_CRAFT],
    projectSlugs: ["melty-bead-craft"],
    published: true,
    featured: true,
    sortOrder: 0,
    image: CRAFT_MATERIALS_IMAGE,
  },
] as const satisfies readonly PublicCatalogueSeed[];

export const PUBLIC_CATALOGUE_AVAILABILITY_NOTE: LocalizedString = {
  en: "Project bases, colours, materials, and styles may vary in store.",
  zh: "项目底座、颜色、材料和款式以店内实际供应为准。",
};
