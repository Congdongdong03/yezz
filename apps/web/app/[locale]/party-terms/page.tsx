import { buildLegalPageMetadata, renderLegalPage } from "@/lib/legal/page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: "en" | "zh" }>;
}) {
  const { locale } = await params;
  return buildLegalPageMetadata({ locale, slug: "party-terms" });
}

export default async function PartyTermsPage({
  params,
}: {
  params: Promise<{ locale: "en" | "zh" }>;
}) {
  const { locale } = await params;
  return renderLegalPage(locale, "party-terms");
}
