export interface LocalizedString {
  en: string;
  zh: string;
}

export interface ProjectCategory {
  _id: string;
  name: LocalizedString;
  slug: { current: string };
  description?: LocalizedString;
  icon?: string;
  order: number;
}

export interface DIYProject {
  _id: string;
  name: LocalizedString;
  slug: { current: string };
  category: { _ref: string } | ProjectCategory;
  description?: LocalizedString;
  images: Array<{
    asset: { _ref: string; url: string };
  }>;
  priceRange?: string;
  duration?: string;
  tags: string[];
  order: number;
}

export interface PartyPackage {
  _id: string;
  name: LocalizedString;
  slug: { current: string };
  description?: LocalizedString;
  includes: LocalizedString[];
  images: Array<{
    asset: { _ref: string; url: string };
  }>;
  minPeople: number;
  maxPeople: number;
  priceIndicator?: string;
  tags: string[];
}

export interface GalleryImage {
  _id: string;
  image: {
    asset: { _ref: string; url: string };
  };
  category: string;
  caption?: LocalizedString;
  order: number;
}

export interface SiteSettings {
  _id: string;
  storeName: string;
  address?: string;
  businessHours?: string;
  phone?: string;
  email?: string;
  wechatQrCode?: { asset: { url: string } };
  instagram?: string;
  xiaohongshu?: string;
  googleMapUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
}
