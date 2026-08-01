import { clearLegacyAdminToken } from "./auth";
import { parseResponse } from "@/lib/api/base";
import type {
  AdminProjectsList,
  AdminCatalogueEntry,
  AuthUser,
  Category,
  GalleryFormInput,
  GalleryImage,
  LoginResponse,
  Booking,
  BookingTransitionInput,
  CartOrder,
  CartOrderList,
  AdminUser,
  PasswordChangeInput,
  TimeSlot,
  UnreadCounts,
  AdminQueueSummary,
  AdminQueueListOptions,
  PartyFormInput,
  PartyPackage,
  ProjectDetail,
  ProjectFormInput,
  CatalogueFormInput,
  SiteSettings,
  UploadResult,
  EmailDelivery,
  EmailDeliveryList,
  EmailDeliveryListOptions,
  AdminSchedule,
  BookingCalendar,
  RequestSwitchState,
  SpecialHours,
  StudioClosure,
  WeeklyHours,
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

export async function completePasswordSetup(
  token: string,
  newPassword: string,
) {
  return adminFetch<{ ok: true }>("/api/v1/auth/setup-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
    auth: false,
  });
}

export async function requestPasswordReset(email: string) {
  return adminFetch<{ ok: true }>("/api/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
    auth: false,
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

export async function getAdminCatalogue() {
  return adminFetch<AdminCatalogueEntry[]>("/api/v1/admin/catalogue");
}

export async function getAdminCatalogueEntry(id: string) {
  return adminFetch<AdminCatalogueEntry>(`/api/v1/admin/catalogue/${id}`);
}

export async function createCatalogueEntry(data: CatalogueFormInput) {
  return adminFetch<AdminCatalogueEntry>("/api/v1/admin/catalogue", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCatalogueEntry(id: string, data: CatalogueFormInput) {
  return adminFetch<AdminCatalogueEntry>(`/api/v1/admin/catalogue/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
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

function buildQueueQuery(params: AdminQueueListOptions = {}) {
  const entries = Object.entries(params)
    .filter(([, value]) => value != null && value !== "" && value !== false)
    .map(([key, value]) => [key, String(value)]);
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : "";
}

export async function getAdminBookings(params: AdminQueueListOptions = {}) {
  const qs = buildQueueQuery(params);
  const result = await adminFetch<{ data: Booking[]; total: number; page: number; limit: number; totalPages?: number } | Booking[]>(`/api/v1/admin/bookings${qs}`);
  // Support both old array format and new paginated format
  if (Array.isArray(result)) return { data: result, total: result.length, page: 1, limit: result.length };
  return result;
}

export async function getAdminBooking(id: string) {
  return adminFetch<Booking>(`/api/v1/admin/bookings/${id}`);
}

export async function updateBookingStatus(
  id: string,
  input: BookingTransitionInput,
) {
  return adminFetch<Booking>(`/api/v1/admin/bookings/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function getBookingCalendar(from: string, to: string) {
  return adminFetch<BookingCalendar>(
    `/api/v1/admin/bookings/calendar?${new URLSearchParams({ from, to })}`,
  );
}

export async function runBookingTransition(
  id: string,
  input: BookingTransitionInput,
) {
  return adminFetch<Booking>(`/api/v1/admin/bookings/${id}/transitions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function recordBookingCharge(
  id: string,
  input: {
    expectedStatus: "confirmed_paid";
    operationId: string;
    type: "cake_cutting" | "cleaning" | "overtime";
    amountCents: number;
    note?: string;
  },
) {
  return adminFetch<Booking>(`/api/v1/admin/bookings/${id}/charges`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function recordBookingPayment(
  id: string,
  input: {
    expectedStatus: "awaiting_in_store_payment";
    operationId: string;
    amountCents: 9500 | 14500;
    paidAt: string;
  },
) {
  return adminFetch<Booking>(`/api/v1/admin/bookings/${id}/payment`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function recordBookingRefund(
  id: string,
  input: {
    expectedStatus: "cancelled";
    operationId: string;
    refundedAt: string;
  },
) {
  return adminFetch<Booking>(`/api/v1/admin/bookings/${id}/refund`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getAdminSchedule() {
  return adminFetch<AdminSchedule>("/api/v1/admin/settings/schedule");
}

export async function updateWeeklyHours(
  days: WeeklyHours[],
  acknowledgement?: { fingerprint: string },
) {
  return adminFetch<{ weekly: WeeklyHours[] }>(
    "/api/v1/admin/settings/schedule/weekly",
    {
      method: "PUT",
      body: JSON.stringify({ days, acknowledgement }),
    },
  );
}

export async function saveSpecialHours(input: Omit<SpecialHours, "note"> & {
  note?: string | null;
  acknowledgement?: { fingerprint: string };
}) {
  return adminFetch<SpecialHours>(
    "/api/v1/admin/settings/schedule/special-hours",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function createStudioClosure(input: Omit<StudioClosure, "id"> & {
  acknowledgement?: { fingerprint: string };
}) {
  return adminFetch<StudioClosure>(
    "/api/v1/admin/settings/schedule/closures",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export async function deleteStudioClosure(id: string) {
  return adminFetch<{ id: string }>(
    `/api/v1/admin/settings/schedule/closures/${id}`,
    { method: "DELETE" },
  );
}

export async function updateRequestSwitches(input: Partial<
  Record<"experience" | "party" | "product", boolean>
>) {
  return adminFetch<RequestSwitchState>(
    "/api/v1/admin/settings/request-switches",
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export async function getUnreadCounts() {
  return adminFetch<UnreadCounts>("/api/v1/admin/notifications/unread-count");
}

export async function getAdminQueueSummary() {
  return adminFetch<AdminQueueSummary>("/api/v1/admin/notifications/summary");
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
  role: "owner" | "admin" | "staff";
}) {
  return adminFetch<{ user: AdminUser }>("/api/v1/admin/users", {
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
  return adminFetch<{ user: AdminUser }>(`/api/v1/admin/users/${id}/reset-password`, {
    method: "POST",
  });
}

export async function deleteAdminUser(id: string) {
  return adminFetch<{ id: string }>(`/api/v1/admin/users/${id}`, {
    method: "DELETE",
  });
}

export async function getAdminOrders(params: AdminQueueListOptions = {}) {
  return adminFetch<CartOrderList>(`/api/v1/admin/orders${buildQueueQuery(params)}`);
}

export async function getAdminOrder(id: string) {
  return adminFetch<CartOrder>(`/api/v1/admin/orders/${id}`);
}

export async function updateOrderStatus(
  id: string,
  input: BookingTransitionInput,
) {
  return adminFetch<CartOrder>(`/api/v1/admin/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
