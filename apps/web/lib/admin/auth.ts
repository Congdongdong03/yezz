/** Legacy key — cleared on logout for users who logged in before cookie auth. */
const LEGACY_TOKEN_KEY = "yezz_admin_token";

export function clearLegacyAdminToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}
