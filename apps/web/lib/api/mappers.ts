import type {
  ApiCatalogueEntry,
  ApiCategory,
  ApiGalleryImage,
  ApiParty,
  ApiProjectDetail,
  ApiProjectListItem,
  ApiSiteSettings,
} from "./types";
import { sanitizePublicWeChatId } from "@/lib/site/business";

function slugField(slug: string) {
  return { current: slug };
}

function optional<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

const CATALOGUE_CATEGORY_PRESENTATION: Record<
  string,
  { order: number; name: { en: string; zh: string } }
> = {
  "air-dry-cream-piping": {
    order: 0,
    name: { en: "Deco Cream DIY", zh: "奶油胶DIY" },
  },
  "paint-clay": {
    order: 1,
    name: { en: "Plaster Painting", zh: "石膏彩绘" },
  },
  beading: {
    order: 2,
    name: { en: "Beading", zh: "串珠" },
  },
  "melty-beads": {
    order: 3,
    name: { en: "Melty Beads", zh: "拼豆" },
  },
};

export function catalogueCategoryOrder(slug: string): number {
  return CATALOGUE_CATEGORY_PRESENTATION[slug]?.order ?? Number.MAX_SAFE_INTEGER;
}

/** API category → shape expected by CategoryNav / CategorySection */
export function mapCategoryFromApi(category: ApiCategory) {
  return {
    _id: category.id,
    name: category.name,
    slug: slugField(category.slug),
    description: optional(category.description),
    icon: optional(category.icon),
    order: category.sortOrder,
  };
}

/** API list item → shape expected by project list + grouping */
export function mapProjectListItemFromApi(project: ApiProjectListItem) {
  return {
    _id: project.id,
    name: project.name,
    slug: slugField(project.slug),
    category: {
      _id: project.category.id,
      name: project.category.name,
      slug: slugField(project.category.slug),
      icon: optional(project.category.icon),
      order: 0,
    },
    projectType: project.projectType,
    description: optional(project.description),
    imageUrl: optional(project.coverImageUrl),
    priceRange: optional(project.priceRange),
    priceMin: project.priceMin,
    priceMax: project.priceMax,
    priceCurrency: project.priceCurrency,
    priceDisplay: optional(project.priceDisplay ?? project.priceRange),
    duration: optional(project.duration),
    durationMinutes: project.durationMinutes,
    bookable: project.bookable,
    variantSelectedInStore: project.variantSelectedInStore,
    extraTimeMinutes: project.extraTimeMinutes,
    extraTimePriceCents: project.extraTimePriceCents,
    tags: project.tags ?? [],
    order: project.sortOrder,
  };
}

/** API detail → shape expected by ProjectDetail */
export function mapProjectDetailFromApi(project: ApiProjectDetail) {
  const images = [...project.images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((img) => img.url);

  const cover = project.coverImageUrl ?? images[0];
  const gallery = images.length > 0 ? images : cover ? [cover] : [];

  return {
    _id: project.id,
    name: project.name,
    slug: slugField(project.slug),
    projectType: project.projectType,
    category: {
      _id: project.category.id,
      name: project.category.name,
      slug: slugField(project.category.slug),
    },
    description: optional(project.description),
    imageUrl: cover,
    images: gallery,
    styles: [...project.styles]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((style) => ({
        _id: style.id,
        name: style.name,
        price: optional(style.price),
        priceDisplay: optional(style.priceDisplay),
        imageUrl: optional(style.imageUrl),
      })),
    priceRange: optional(project.priceRange),
    priceMin: project.priceMin,
    priceMax: project.priceMax,
    priceCurrency: project.priceCurrency,
    priceDisplay: optional(project.priceDisplay ?? project.priceRange),
    duration: optional(project.duration),
    durationMinutes: project.durationMinutes,
    bookable: project.bookable,
    variantSelectedInStore: project.variantSelectedInStore,
    extraTimeMinutes: project.extraTimeMinutes,
    extraTimePriceCents: project.extraTimePriceCents,
    tags: project.tags ?? [],
    order: project.sortOrder,
  };
}

/** Curated public catalogue DTO → customer-facing editorial project shape. */
export function mapCatalogueEntryFromApi(entry: ApiCatalogueEntry) {
  return {
    _id: entry.id,
    name: entry.name,
    slug: slugField(entry.slug),
    description: entry.description,
    durationDisplay: entry.durationDisplay,
    occasionTags: entry.occasionTags,
    availabilityNote: entry.availabilityNote,
    featured: entry.featured,
    order: entry.sortOrder,
    imageUrl: optional(entry.coverImageUrl),
    image: entry.image,
    category: {
      _id: entry.category.id,
      name:
        CATALOGUE_CATEGORY_PRESENTATION[entry.category.slug]?.name ??
        entry.category.name,
      slug: slugField(entry.category.slug),
      icon: optional(entry.category.icon),
      order: catalogueCategoryOrder(entry.category.slug),
    },
    variants: [...entry.variants]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((variant) => ({
        _id: variant.projectId,
        projectId: variant.projectId,
        slug: variant.slug,
        name: variant.name,
        label: optional(variant.label),
        priceDisplay: optional(variant.priceDisplay),
        bookable: variant.bookable,
        order: variant.sortOrder,
        extraTimeMinutes: variant.extraTimeMinutes,
        extraTimePriceCents: variant.extraTimePriceCents,
      })),
    priceDisplay: optional(entry.priceDisplay),
  };
}

export function mapPartyFromApi(party: ApiParty) {
  return {
    _id: party.id,
    name: party.name,
    slug: slugField(party.slug),
    description: optional(party.description),
    includes: party.includes,
    imageUrl: optional(party.imageUrl),
    images: party.imageUrls,
    minPeople: party.minPeople,
    maxPeople: party.maxPeople,
    priceIndicator: optional(party.priceIndicator),
    guestDurationMinutes: party.guestDurationMinutes,
    setupMinutes: party.setupMinutes,
    cleanupMinutes: party.cleanupMinutes,
    venueFeeCents: party.venueFeeCents,
    minSpendPerPersonCents: party.minSpendPerPersonCents,
    minParents: party.minParents,
    maxParents: party.maxParents,
    tags: optional(party.tags),
  };
}

export function mapGalleryImageFromApi(image: ApiGalleryImage) {
  return {
    _id: image.id,
    imageUrl: image.imageUrl,
    category: image.category,
    caption: optional(image.caption),
    order: image.sortOrder,
  };
}

export function mapSiteSettingsFromApi(settings: ApiSiteSettings) {
  const wechatId = sanitizePublicWeChatId(settings.wechatId);
  const capabilities = settings.requestCapabilities as
    | Partial<ApiSiteSettings["requestCapabilities"]>
    | null
    | undefined;

  return {
    storeName: settings.storeName,
    address: optional(settings.address),
    businessHours: optional(settings.businessHours),
    phone: optional(settings.phone),
    email: optional(settings.email),
    wechatId,
    wechatQrCodeUrl: wechatId ? optional(settings.wechatQrUrl) : undefined,
    heroImageUrl: optional(settings.heroImageUrl),
    instagram: optional(settings.instagram),
    xiaohongshu: optional(settings.xiaohongshu),
    googleMapUrl: optional(settings.googleMapUrl),
    seoTitle: optional(settings.seoTitle),
    seoDescription: optional(settings.seoDescription),
    requestCapabilities: {
      experience: capabilities?.experience === true,
      product: capabilities?.product === true,
      party: capabilities?.party === true,
    },
  };
}
