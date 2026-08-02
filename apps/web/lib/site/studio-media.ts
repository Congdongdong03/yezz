export const STUDIO_MEDIA_ROLES = [
  "store",
  "arrival",
  "process",
  "party",
  "community",
] as const;

export type StudioMediaRole = (typeof STUDIO_MEDIA_ROLES)[number];

type StudioMediaInput = {
  _id: string;
  imageUrl?: string;
  category?: string;
  order?: number;
};

export type StudioMediaSelection<T extends StudioMediaInput> = {
  hero: T | null;
  arrival: T | null;
  store: T[];
  process: T[];
  party: T[];
  community: T[];
  legacy: T[];
};

function sortByDisplayOrder<T extends StudioMediaInput>(images: T[]): T[] {
  return images
    .map((image, index) => ({ image, index }))
    .sort(
      (left, right) =>
        (left.image.order ?? Number.MAX_SAFE_INTEGER) -
          (right.image.order ?? Number.MAX_SAFE_INTEGER) ||
        left.index - right.index,
    )
    .map(({ image }) => image);
}

export function selectStudioMedia<T extends StudioMediaInput>(
  images: T[],
): StudioMediaSelection<T> {
  const publishable = sortByDisplayOrder(
    images.filter((image) => Boolean(image.imageUrl?.trim())),
  );
  const byRole = (role: StudioMediaRole) =>
    publishable.filter((image) => image.category === role);
  const store = byRole("store");
  const explicitArrival = byRole("arrival");

  return {
    hero: store[0] ?? null,
    arrival: explicitArrival[0] ?? store[0] ?? null,
    store,
    process: byRole("process"),
    party: byRole("party"),
    community: byRole("community"),
    legacy: publishable.filter(
      (image) =>
        !STUDIO_MEDIA_ROLES.includes(image.category as StudioMediaRole),
    ),
  };
}
