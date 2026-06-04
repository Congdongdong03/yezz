import { clearAdminToken, getAdminToken } from "./auth";
import type {
  AdminProjectsList,
  AuthUser,
  Category,
  LoginResponse,
  ProjectDetail,
  ProjectFormInput,
  SiteSettings,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type ApiSuccess<T> = { success: true; data: T };
type ApiError = { success: false; error: { code: string; message: string } };

export class AdminApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiSuccess<T> | ApiError;

  if (!json.success) {
    if (res.status === 401) {
      clearAdminToken();
    }
    throw new AdminApiError(
      json.error?.message ?? "Request failed",
      json.error?.code,
      res.status,
    );
  }

  return json.data;
}

export async function adminFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, ...init } = options;
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = getAdminToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  return parseResponse<T>(res);
}

export async function login(email: string, password: string) {
  return adminFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    auth: false,
  });
}

export async function getMe() {
  return adminFetch<AuthUser>("/api/v1/admin/me");
}

export async function getAdminProjects() {
  return adminFetch<AdminProjectsList>("/api/v1/admin/projects?limit=100");
}

export async function getAdminProject(id: string) {
  return adminFetch<ProjectDetail>(`/api/v1/admin/projects/${id}`);
}

export async function createProject(data: ProjectFormInput) {
  return adminFetch<ProjectDetail>("/api/v1/admin/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProject(id: string, data: Partial<ProjectFormInput>) {
  return adminFetch<ProjectDetail>(`/api/v1/admin/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: string) {
  return adminFetch<{ id: string }>(`/api/v1/admin/projects/${id}`, {
    method: "DELETE",
  });
}

export async function getAdminCategories() {
  return adminFetch<Category[]>("/api/v1/admin/categories");
}

export async function updateCategory(
  id: string,
  data: Partial<Pick<Category, "name" | "description" | "icon" | "sortOrder">>,
) {
  return adminFetch<Category>(`/api/v1/admin/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getAdminSettings() {
  return adminFetch<SiteSettings>("/api/v1/admin/settings");
}

export async function updateAdminSettings(
  data: Partial<Omit<SiteSettings, "id">>,
) {
  return adminFetch<SiteSettings>("/api/v1/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
