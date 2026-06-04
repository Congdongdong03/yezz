import {
  fetchCategories,
  fetchProjectBySlug,
  fetchProjects,
  PublicApiError,
} from "@/lib/api/client";
import { isApiEnabled } from "@/lib/api/config";
import { loadFailed, loadOk, type LoadResult } from "@/lib/api/load-result";
import {
  mapCategoryFromApi,
  mapProjectDetailFromApi,
  mapProjectListItemFromApi,
} from "@/lib/api/mappers";
import { mockCategories, mockProjects } from "@/lib/mock-data";

export type ProjectsPageData = {
  projects: ReturnType<typeof mapProjectListItemFromApi>[];
  categories: ReturnType<typeof mapCategoryFromApi>[];
};

function loadFromMock(): ProjectsPageData {
  return {
    projects: mockProjects.map((p) => ({
      ...p,
      priceDisplay: p.priceRange,
      category: p.category as ProjectsPageData["projects"][0]["category"],
    })) as ProjectsPageData["projects"],
    categories: mockCategories as ProjectsPageData["categories"],
  };
}

export async function loadProjectsPageData(): Promise<LoadResult<ProjectsPageData>> {
  if (isApiEnabled()) {
    try {
      const [apiProjects, apiCategories] = await Promise.all([
        fetchProjects(),
        fetchCategories(),
      ]);
      return loadOk({
        projects: apiProjects.map(mapProjectListItemFromApi),
        categories: apiCategories.map(mapCategoryFromApi),
      });
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[projects] API unavailable:",
          err instanceof PublicApiError ? err.message : err,
        );
      }
      return loadFailed();
    }
  }

  return loadOk(loadFromMock());
}

export type ProjectBySlugResult = LoadResult<
  ReturnType<typeof mapProjectDetailFromApi> | null
>;

export async function loadProjectBySlug(slug: string): Promise<ProjectBySlugResult> {
  if (isApiEnabled()) {
    try {
      const detail = await fetchProjectBySlug(slug);
      return loadOk(mapProjectDetailFromApi(detail));
    } catch (err) {
      if (err instanceof PublicApiError && err.status === 404) {
        return loadOk(null);
      }
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[project detail] API unavailable:",
          err instanceof PublicApiError ? err.message : err,
        );
      }
      return loadFailed();
    }
  }

  return loadOk(
    (mockProjects.find((p) => p.slug.current === slug) ??
      null) as ReturnType<typeof mapProjectDetailFromApi> | null,
  );
}

export function groupProjectsByCategory(
  projects: ProjectsPageData["projects"],
  categories: ProjectsPageData["categories"],
) {
  const displayCategories = [...categories].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  const grouped = displayCategories
    .map((cat) => ({
      category: cat,
      projects: projects.filter(
        (p) => p.category?.slug?.current === cat.slug.current,
      ),
    }))
    .filter((g) => g.projects.length > 0);

  if (grouped.length > 0) {
    return { displayCategories, grouped };
  }

  const fallback = loadFromMock();
  const sorted = [...fallback.categories].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  return {
    displayCategories: sorted,
    grouped: sorted
      .map((cat) => ({
        category: cat,
        projects: fallback.projects.filter(
          (p) => p.category?.slug?.current === cat.slug.current,
        ),
      }))
      .filter((g) => g.projects.length > 0),
  };
}
