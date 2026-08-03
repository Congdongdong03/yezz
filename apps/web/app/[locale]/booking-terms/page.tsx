import { buildLegalPageMetadata, renderLegalPage } from "@/lib/legal/page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: "en" | "zh" }>;
}) {
  const { locale } = await params;
  return buildLegalPageMetadata({ locale, slug: "booking-terms" });
}

export default async function BookingTermsPage({
  params,
}: {
  params: Promise<{ locale: "en" | "zh" }>;
}) {
  const { locale } = await params;
  return renderLegalPage(locale, "booking-terms");
}
