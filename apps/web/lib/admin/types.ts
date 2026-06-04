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

export type PartyPackage = {
  id: string;
  name: LocalizedString;
  slug: string;
  description: LocalizedString | null;
  includes: LocalizedString[];
  imageUrl: string | null;
  imageUrls: string[];
  minPeople: number;
  maxPeople: number;
  priceIndicator: string | null;
  tags: string[] | null;
  sortOrder: number;
};

export type PartyFormInput = {
  name: LocalizedString;
  slug: string;
  description: LocalizedString | null;
  includes: LocalizedString[];
  coverImageUrl: string | null;
  imageUrls: string[];
  minPeople: number;
  maxPeople: number;
  priceIndicator: string | null;
  tags: string[] | null;
  sortOrder: number;
};

export type GalleryImage = {
  id: string;
  imageUrl: string;
  category: string;
  caption: LocalizedString | null;
  sortOrder: number;
};

export type GalleryFormInput = {
  imageUrl: string;
  category: string;
  caption: LocalizedString | null;
  sortOrder: number;
};

export type UploadResult = {
  id: string;
  url: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
};

export type OrderStatus = "new" | "contacted" | "confirmed" | "cancelled";

export type Booking = {
  id: string;
  name: string;
  phone: string;
  wechat: string | null;
  email: string | null;
  preferredDate: string | null;
  numberOfPeople: number | null;
  activityType: string | null;
  interestedProject: string | null;
  message: string | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

export type CartOrderItem = {
  id: string;
  projectId: string | null;
  projectName: LocalizedString | string | null;
  projectType: "experience" | "product" | null;
  styleName: LocalizedString | string | null;
  date: string | null;
  people: number | null;
  price: string | null;
  sortOrder: number;
};

export type CartOrder = {
  id: string;
  name: string;
  phone: string;
  wechat: string | null;
  message: string | null;
  status: OrderStatus;
  items: CartOrderItem[];
  createdAt: string;
  updatedAt: string;
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
