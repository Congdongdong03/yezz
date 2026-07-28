import { clearLegacyAdminToken } from "./auth";
import { parseResponse } from "@/lib/api/base";
import type {
  AdminProjectsList,
  AuthUser,
  Category,
  GalleryFormInput,
  GalleryImage,
  LoginResponse,
  Booking,
  CartOrder,
  AdminUser,
  PasswordChangeInput,
  TimeSlot,
  UnreadCounts,
  PartyFormInput,
  PartyPackage,
  ProjectDetail,
  ProjectFormInput,
  SiteSettings,
  UploadResult,
  EmailDelivery,
  EmailDeliveryList,
  EmailDeliveryListOptions,
} from "./types";
import { buildEmailDeliveryQuery } from "./email-delivery";

function backendPath(path: string): string {
  if (!path.startsWith("/api/v1/")) {
    throw new Error("Admin API paths must start with /api/v1/");
  }
  return `/api/backend/v1/${path.slice("/api/v1/".length)}`;
}

export async function adminFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, ...init } = options;
  const headers = new Headers(init.headers);

  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(backendPath(path), {
    ...init,
    headers,
    credentials: auth ? "include" : init.credentials,
  });
  return parseResponse<T>(res);
}

export async function login(email: string, password: string) {
  return adminFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    auth: false,
    credentials: "include",
  });
}

export async function logout() {
  clearLegacyAdminToken();
  return adminFetch<{ ok: boolean }>("/api/v1/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}

export async function getMe() {
  return adminFetch<AuthUser>("/api/v1/admin/me");
}

export async function changeMyPassword(data: PasswordChangeInput) {
  return adminFetch<{ ok: true }>("/api/v1/admin/me/password", {
    method: "POST",
    body: JSON.stringify(data),
  });
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

export async function createCategory(data: { name: { en: string; zh: string }; slug: string; description?: { en: string; zh: string } | null; icon?: string | null; sortOrder?: number }) {
  return adminFetch<Category>("/api/v1/admin/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
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

export async function deleteCategory(id: string) {
  return adminFetch<{ id: string }>(`/api/v1/admin/categories/${id}`, {
    method: "DELETE",
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

export async function uploadAdminImage(file: File) {
  const body = new FormData();
  body.append("file", file);
  return adminFetch<UploadResult>("/api/v1/admin/upload", {
    method: "POST",
    body,
  });
}

export async function getAdminParties() {
  return adminFetch<PartyPackage[]>("/api/v1/admin/parties");
}

export async function getAdminParty(id: string) {
  return adminFetch<PartyPackage>(`/api/v1/admin/parties/${id}`);
}

export async function createParty(data: PartyFormInput) {
  return adminFetch<PartyPackage>("/api/v1/admin/parties", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateParty(id: string, data: Partial<PartyFormInput>) {
  return adminFetch<PartyPackage>(`/api/v1/admin/parties/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteParty(id: string) {
  return adminFetch<{ id: string }>(`/api/v1/admin/parties/${id}`, {
    method: "DELETE",
  });
}

export async function getAdminGallery() {
  return adminFetch<GalleryImage[]>("/api/v1/admin/gallery");
}

export async function getAdminGalleryImage(id: string) {
  return adminFetch<GalleryImage>(`/api/v1/admin/gallery/${id}`);
}

export async function createGalleryImage(data: GalleryFormInput) {
  return adminFetch<GalleryImage>("/api/v1/admin/gallery", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateGalleryImage(id: string, data: Partial<GalleryFormInput>) {
  return adminFetch<GalleryImage>(`/api/v1/admin/gallery/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteGalleryImage(id: string) {
  return adminFetch<{ id: string }>(`/api/v1/admin/gallery/${id}`, {
    method: "DELETE",
  });
}

export async function getAdminBookings(params?: { page?: number; limit?: number; status?: string }) {
  const qs = params ? `?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))).toString()}` : "";
  const result = await adminFetch<{ data: Booking[]; total: number; page: number; limit: number } | Booking[]>(`/api/v1/admin/bookings${qs}`);
  // Support both old array format and new paginated format
  if (Array.isArray(result)) return { data: result, total: result.length, page: 1, limit: result.length };
  return result;
}

export async function getAdminBooking(id: string) {
  return adminFetch<Booking>(`/api/v1/admin/bookings/${id}`);
}

export async function updateBookingStatus(
  id: string,
  status: Booking["status"],
  note?: string,
) {
  return adminFetch<Booking>(`/api/v1/admin/bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, note }),
  });
}

export async function getUnreadCounts() {
  return adminFetch<UnreadCounts>("/api/v1/admin/notifications/unread-count");
}

export async function markNotificationsRead(type: "bookings" | "orders") {
  return adminFetch<{ type: string }>(
    `/api/v1/admin/notifications/mark-read?type=${type}`,
    { method: "PATCH" },
  );
}

export async function getAdminTimeSlots() {
  return adminFetch<TimeSlot[]>("/api/v1/admin/time-slots");
}

export async function createAdminTimeSlot(data: Record<string, unknown>) {
  return adminFetch<TimeSlot | TimeSlot[]>("/api/v1/admin/time-slots", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAdminTimeSlot(id: string, data: Record<string, unknown>) {
  return adminFetch<TimeSlot>(`/api/v1/admin/time-slots/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAdminTimeSlot(id: string) {
  return adminFetch<{ id: string }>(`/api/v1/admin/time-slots/${id}`, {
    method: "DELETE",
  });
}

export async function getEmailDeliveries(
  options: EmailDeliveryListOptions = {},
) {
  const query = buildEmailDeliveryQuery(options);
  return adminFetch<EmailDeliveryList>(
    `/api/v1/admin/email-deliveries?${query}`,
  );
}

export async function retryEmailDelivery(id: string) {
  return adminFetch<EmailDelivery>(
    `/api/v1/admin/email-deliveries/${id}/retry`,
    { method: "POST" },
  );
}

export async function getAdminUsers() {
  return adminFetch<AdminUser[]>("/api/v1/admin/users");
}

export async function createAdminUser(data: {
  email: string;
  name: string;
  role: "admin" | "staff";
  password?: string;
}) {
  return adminFetch<{ user: AdminUser; initialPassword: string }>("/api/v1/admin/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAdminUser(
  id: string,
  data: Partial<Pick<AdminUser, "email" | "name" | "role">>,
) {
  return adminFetch<AdminUser>(`/api/v1/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function resetAdminUserPassword(id: string) {
  return adminFetch<{ user: AdminUser; newPassword: string }>(`/api/v1/admin/users/${id}/reset-password`, {
    method: "POST",
  });
}

export async function deleteAdminUser(id: string) {
  return adminFetch<{ id: string }>(`/api/v1/admin/users/${id}`, {
    method: "DELETE",
  });
}

export async function getAdminOrders() {
  return adminFetch<CartOrder[]>("/api/v1/admin/orders");
}

export async function getAdminOrder(id: string) {
  return adminFetch<CartOrder>(`/api/v1/admin/orders/${id}`);
}

export async function updateOrderStatus(id: string, status: CartOrder["status"]) {
  return adminFetch<CartOrder>(`/api/v1/admin/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
