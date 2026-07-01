import type {
  ApiCategory,
  ApiGalleryImage,
  ApiParty,
  ApiProjectDetail,
  ApiProjectListItem,
  ApiSiteSettings,
} from "./types";

function slugField(slug: string) {
  return { current: slug };
}

function optional<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
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
    priceDisplay: optional(project.priceDisplay ?? project.priceRange),
    duration: optional(project.duration),
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
        name: style.name,
        price: optional(style.price),
        priceDisplay: optional(style.priceDisplay),
        imageUrl: optional(style.imageUrl),
      })),
    priceRange: optional(project.priceRange),
    priceDisplay: optional(project.priceDisplay ?? project.priceRange),
    duration: optional(project.duration),
    tags: project.tags ?? [],
    order: project.sortOrder,
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
  return {
    storeName: settings.storeName,
    address: optional(settings.address),
    businessHours: optional(settings.businessHours),
    phone: optional(settings.phone),
    email: optional(settings.email),
    wechatId: optional(settings.wechatId),
    wechatQrCodeUrl: optional(settings.wechatQrUrl),
    heroImageUrl: optional(settings.heroImageUrl),
    instagram: optional(settings.instagram),
    xiaohongshu: optional(settings.xiaohongshu),
    googleMapUrl: optional(settings.googleMapUrl),
    seoTitle: optional(settings.seoTitle),
    seoDescription: optional(settings.seoDescription),
  };
}
