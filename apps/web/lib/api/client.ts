import { getApiBaseUrl } from "./config";
import { ApiClientError, parseResponse } from "./base";

export { ApiClientError } from "./base";

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
    throw new ApiClientError(
      cause instanceof Error ? cause.message : "Failed to reach API",
      "NETWORK_ERROR",
    );
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiClientError("Invalid API response", "PARSE_ERROR", res.status);
  }

  return parseResponse<T>(new Response(JSON.stringify(json), { status: res.status, headers: res.headers }));
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
