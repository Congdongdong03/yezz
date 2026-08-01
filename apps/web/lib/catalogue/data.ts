import {
  fetchCatalogue,
  fetchCatalogueBySlug,
} from "@/lib/api/client";
import { ApiClientError } from "@/lib/api/base";
import { isApiEnabled } from "@/lib/api/config";
import { loadFailed, loadOk, type LoadResult } from "@/lib/api/load-result";
import { mapCatalogueEntryFromApi } from "@/lib/api/mappers";

export { mapCatalogueEntryFromApi } from "@/lib/api/mappers";

export type CatalogueEntryView = ReturnType<typeof mapCatalogueEntryFromApi>;

export async function loadCataloguePageData(): Promise<
  LoadResult<CatalogueEntryView[]>
> {
  if (!isApiEnabled()) return loadFailed();

  try {
    const entries = (await fetchCatalogue())
      .map(mapCatalogueEntryFromApi)
      .sort(
        (a, b) =>
          a.category.order - b.category.order ||
          a.order - b.order ||
          a.slug.current.localeCompare(b.slug.current),
      );
    return loadOk(entries);
  } catch {
    return loadFailed();
  }
}

export type CatalogueEntryBySlugResult = LoadResult<CatalogueEntryView | null>;

export async function loadCatalogueEntry(
  slug: string,
): Promise<CatalogueEntryBySlugResult> {
  if (!isApiEnabled()) return loadOk(null);

  try {
    return loadOk(mapCatalogueEntryFromApi(await fetchCatalogueBySlug(slug)));
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      return loadOk(null);
    }
    return loadFailed();
  }
}
