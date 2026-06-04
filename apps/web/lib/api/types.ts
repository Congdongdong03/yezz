export type LocalizedString = { en: string; zh: string };

export type ApiCategory = {
  id: string;
  name: LocalizedString;
  slug: string;
  description: LocalizedString | null;
  icon: string | null;
  sortOrder: number;
};

export type ApiProjectListItem = {
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

export type ApiProjectStyle = {
  id: string;
  name: LocalizedString;
  imageUrl: string | null;
  price: string | null;
  sortOrder: number;
};

export type ApiProjectImage = {
  id: string;
  url: string;
  sortOrder: number;
};

export type ApiProjectDetail = ApiProjectListItem & {
  styles: ApiProjectStyle[];
  images: ApiProjectImage[];
};
