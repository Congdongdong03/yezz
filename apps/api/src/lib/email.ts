import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "YEZZ <bookings@yezz.studio>";

export async function sendOwnerEmail(subject: string, html: string): Promise<void> {
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!resend || !ownerEmail) {
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject,
    html,
  });
}

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
