import type { LocalizedString } from "./schema/index.js";

type DemoCategory = {
  name: LocalizedString;
  slug: { current: string };
  description: LocalizedString;
  icon: string;
  order: number;
};

type DemoProject = {
  _id: string;
  category: { slug: { current: string } };
  name: LocalizedString;
  slug: { current: string };
  projectType: "experience" | "product";
  description: LocalizedString;
  priceRange: string;
  duration: string;
  tags: string[];
  order: number;
  imageUrl: null;
  styles: Array<{
    name: LocalizedString;
    imageUrl: string | null;
    price: string | null;
  }>;
  images: string[];
};

type DemoParty = {
  name: LocalizedString;
  slug: { current: string };
  description: LocalizedString;
  includes: LocalizedString[];
  imageUrl: null;
  images: string[];
  minPeople: number;
  maxPeople: number;
  priceIndicator: string;
  tags: string[];
};

export const mockCategories: DemoCategory[] = [
  {
    name: { en: "Demo Experiences", zh: "演示体验" },
    slug: { current: "demo-experiences" },
    description: {
      en: "Development-only sample experiences.",
      zh: "仅供本地开发使用的示例体验。",
    },
    icon: "sparkles",
    order: 0,
  },
  {
    name: { en: "Demo Products", zh: "演示成品" },
    slug: { current: "demo-products" },
    description: {
      en: "Development-only sample products.",
      zh: "仅供本地开发使用的示例成品。",
    },
    icon: "package",
    order: 1,
  },
];

export const mockProjects: DemoProject[] = [
  {
    _id: "demo-experience",
    category: { slug: { current: "demo-experiences" } },
    name: { en: "Demo Craft Experience", zh: "演示手作体验" },
    slug: { current: "demo-craft-experience" },
    projectType: "experience",
    description: {
      en: "Local development sample. Never publish this record.",
      zh: "本地开发示例，请勿发布。",
    },
    priceRange: "A$20",
    duration: "30 min",
    tags: ["development-only"],
    order: 0,
    imageUrl: null,
    styles: [],
    images: [],
  },
  {
    _id: "demo-product",
    category: { slug: { current: "demo-products" } },
    name: { en: "Demo Craft Product", zh: "演示手作成品" },
    slug: { current: "demo-craft-product" },
    projectType: "product",
    description: {
      en: "Local development sample. Never publish this record.",
      zh: "本地开发示例，请勿发布。",
    },
    priceRange: "A$10",
    duration: "20 min",
    tags: ["development-only"],
    order: 1,
    imageUrl: null,
    styles: [],
    images: [],
  },
];

export const mockParties: DemoParty[] = [
  {
    name: { en: "Demo Party", zh: "演示派对" },
    slug: { current: "demo-party" },
    description: {
      en: "Development-only party package.",
      zh: "仅供本地开发使用的派对示例。",
    },
    includes: [
      {
        en: "Development-only sample",
        zh: "仅供开发使用的示例",
      },
    ],
    imageUrl: null,
    images: [],
    minPeople: 2,
    maxPeople: 10,
    priceIndicator: "A$0 demo",
    tags: ["development-only"],
  },
];

export const mockGalleryImages: Array<{
  imageUrl: string;
  category: string;
  caption?: LocalizedString;
  order?: number;
}> = [];
