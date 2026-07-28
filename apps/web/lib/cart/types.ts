export interface CartItem {
  projectId: string;
  projectSlug: string;
  projectName: { en: string; zh: string };
  projectType: "experience" | "product";
  imageUrl?: string;
  styleId?: string;
  styleName?: { en: string; zh: string };
  date?: string;
  people?: number;
  price?: string;
}
