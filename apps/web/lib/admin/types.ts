export type LocalizedString = { en: string; zh: string };

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "admin";
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export type Category = {
  id: string;
  name: LocalizedString;
  slug: string;
  description: LocalizedString | null;
  icon: string | null;
  sortOrder: number;
};

export type ProjectStyle = {
  id?: string;
  name: LocalizedString;
  imageUrl: string | null;
  price: string | null;
  sortOrder: number;
};

export type ProjectImage = {
  id?: string;
  url: string;
  sortOrder: number;
};

export type ProjectListItem = {
  id: string;
  name: LocalizedString;
  slug: string;
  projectType: "experience" | "product";
  description: LocalizedString | null;
  priceRange: string | null;
  duration: string | null;
  tags: string[] | null;
  sortOrder: number;
  coverImageUrl: string | null;
  category: {
    id: string;
    name: LocalizedString;
    slug: string;
    icon: string | null;
  };
};

export type ProjectDetail = ProjectListItem & {
  styles: ProjectStyle[];
  images: ProjectImage[];
};

export type AdminProjectsList = {
  items: ProjectListItem[];
  total: number;
  page?: number;
  limit?: number;
};

export type SiteSettings = {
  id: string;
  storeName: string;
  address: string | null;
  businessHours: string | null;
  phone: string | null;
  email: string | null;
  wechatId: string | null;
  wechatQrUrl: string | null;
  heroImageUrl: string | null;
  instagram: string | null;
  xiaohongshu: string | null;
  googleMapUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type ProjectFormInput = {
  categoryId: string;
  name: LocalizedString;
  slug: string;
  projectType: "experience" | "product";
  description: LocalizedString | null;
  priceRange: string | null;
  duration: string | null;
  tags: string[] | null;
  sortOrder: number;
  coverImageUrl: string | null;
  styles: Array<{
    name: LocalizedString;
    imageUrl?: string | null;
    price?: string | null;
    sortOrder?: number;
  }>;
  images: Array<{ url: string; sortOrder?: number }>;
};
