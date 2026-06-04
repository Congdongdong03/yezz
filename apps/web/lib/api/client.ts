import { getApiBaseUrl } from "./config";

type ApiSuccess<T> = { success: true; data: T };
type ApiErrorBody = {
  success: false;
  error: { code: string; message: string };
};

export class PublicApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "PublicApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
      cache: init?.cache ?? "no-store",
    });
  } catch (cause) {
    throw new PublicApiError(
      cause instanceof Error ? cause.message : "Failed to reach API",
      "NETWORK_ERROR",
    );
  }

  let json: ApiSuccess<T> | ApiErrorBody;
  try {
    json = (await res.json()) as ApiSuccess<T> | ApiErrorBody;
  } catch {
    throw new PublicApiError("Invalid API response", "PARSE_ERROR", res.status);
  }

  if (!json.success) {
    throw new PublicApiError(
      json.error?.message ?? "API request failed",
      json.error?.code,
      res.status,
    );
  }

  return json.data;
}

export async function fetchCategories() {
  return apiFetch<import("./types").ApiCategory[]>("/api/v1/categories");
}

export async function fetchProjects() {
  return apiFetch<import("./types").ApiProjectListItem[]>("/api/v1/projects");
}

export async function fetchProjectBySlug(slug: string) {
  return apiFetch<import("./types").ApiProjectDetail>(
    `/api/v1/projects/${encodeURIComponent(slug)}`,
  );
}

export async function fetchParties() {
  return apiFetch<import("./types").ApiParty[]>("/api/v1/parties");
}

export async function fetchPartyBySlug(slug: string) {
  return apiFetch<import("./types").ApiParty>(
    `/api/v1/parties/${encodeURIComponent(slug)}`,
  );
}

export async function fetchGallery() {
  return apiFetch<import("./types").ApiGalleryImage[]>("/api/v1/gallery");
}

export async function fetchSiteSettings() {
  return apiFetch<import("./types").ApiSiteSettings>("/api/v1/settings");
}
