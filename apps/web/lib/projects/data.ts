import {
  fetchCategories,
  fetchProjectBySlug,
  fetchProjects,
  PublicApiError,
} from "@/lib/api/client";
import { isApiEnabled } from "@/lib/api/config";
import {
  mapCategoryFromApi,
  mapProjectDetailFromApi,
  mapProjectListItemFromApi,
} from "@/lib/api/mappers";
import { client, isSanityConfigured } from "@/lib/sanity/client";
import { mockCategories, mockProjects } from "@/lib/sanity/mock-data";
import { categoriesQuery, projectDetailQuery, projectsQuery } from "@/lib/sanity/queries";

export type ProjectsPageData = {
  projects: ReturnType<typeof mapProjectListItemFromApi>[];
  categories: ReturnType<typeof mapCategoryFromApi>[];
};

async function loadFromSanityOrMock(): Promise<ProjectsPageData> {
  let projects: ReturnType<typeof mapProjectListItemFromApi>[] = [];
  let categories: ReturnType<typeof mapCategoryFromApi>[] = [];

  if (isSanityConfigured) {
    try {
      const [sanityProjects, sanityCategories] = await Promise.all([
        client.fetch(projectsQuery),
        client.fetch(categoriesQuery),
      ]);
      projects = sanityProjects ?? [];
      categories = (sanityCategories ?? []).map((c: { order?: number; sortOrder?: number }) => ({
        ...c,
        order: c.order ?? c.sortOrder ?? 0,
      }));
    } catch {
      // fall through to mock
    }
  }

  if (!projects.length) {
    projects = mockProjects.map((p) => ({
      ...p,
      category: p.category as ProjectsPageData["projects"][0]["category"],
    })) as ProjectsPageData["projects"];
  }
  if (!categories.length) {
    categories = mockCategories as ProjectsPageData["categories"];
  }

  return { projects, categories };
}

export async function loadProjectsPageData(): Promise<ProjectsPageData> {
  if (isApiEnabled()) {
    try {
      const [apiProjects, apiCategories] = await Promise.all([
        fetchProjects(),
        fetchCategories(),
      ]);
      return {
        projects: apiProjects.map(mapProjectListItemFromApi),
        categories: apiCategories.map(mapCategoryFromApi),
      };
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[projects] API unavailable, falling back:", err instanceof PublicApiError ? err.message : err);
      }
    }
  }

  return loadFromSanityOrMock();
}

export async function loadProjectBySlug(
  slug: string,
): Promise<ReturnType<typeof mapProjectDetailFromApi> | null> {
  if (isApiEnabled()) {
    try {
      const detail = await fetchProjectBySlug(slug);
      return mapProjectDetailFromApi(detail);
    } catch (err) {
      if (err instanceof PublicApiError && err.status === 404) {
        return null;
      }
      if (process.env.NODE_ENV === "development") {
        console.warn("[project detail] API unavailable, falling back:", err instanceof PublicApiError ? err.message : err);
      }
    }
  }

  if (isSanityConfigured) {
    try {
      const project = await client.fetch(projectDetailQuery, { slug });
      if (project) return project;
    } catch {
      // fall through
    }
  }

  return (
    mockProjects.find((p) => p.slug.current === slug) ??
    null
  ) as ReturnType<typeof mapProjectDetailFromApi> | null;
}

/** Group projects by category for the list page layout */
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

  const fallbackProjects = mockProjects as ProjectsPageData["projects"];
  const fallbackCategories = mockCategories as ProjectsPageData["categories"];
  const sorted = [...fallbackCategories].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  return {
    displayCategories: sorted,
    grouped: sorted
      .map((cat) => ({
        category: cat,
        projects: fallbackProjects.filter(
          (p) => p.category?.slug?.current === cat.slug.current,
        ),
      }))
      .filter((g) => g.projects.length > 0),
  };
}
