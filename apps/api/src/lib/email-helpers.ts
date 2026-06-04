export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function displayLocalized(
  value: { en?: string; zh?: string } | string | null | undefined,
): string {
  if (!value) return "N/A";
  if (typeof value === "string") return value;
  return value.en || value.zh || "N/A";
}
