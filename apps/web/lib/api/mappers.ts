import type {
  ApiCategory,
  ApiProjectDetail,
  ApiProjectListItem,
} from "./types";

function slugField(slug: string) {
  return { current: slug };
}

/** API category → shape expected by CategoryNav / CategorySection */
export function mapCategoryFromApi(category: ApiCategory) {
  return {
    _id: category.id,
    name: category.name,
    slug: slugField(category.slug),
    description: category.description ?? undefined,
    icon: category.icon ?? undefined,
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
      icon: project.category.icon ?? undefined,
      order: 0,
    },
    projectType: project.projectType,
    description: project.description ?? undefined,
    imageUrl: project.coverImageUrl ?? undefined,
    priceRange: project.priceRange ?? undefined,
    duration: project.duration ?? undefined,
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
  const gallery =
    images.length > 0 ? images : cover ? [cover] : [];

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
    description: project.description ?? undefined,
    imageUrl: cover,
    images: gallery,
    styles: [...project.styles]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((style) => ({
        name: style.name,
        price: style.price ?? undefined,
        imageUrl: style.imageUrl ?? undefined,
      })),
    priceRange: project.priceRange ?? undefined,
    duration: project.duration ?? undefined,
    tags: project.tags ?? [],
    order: project.sortOrder,
  };
}
