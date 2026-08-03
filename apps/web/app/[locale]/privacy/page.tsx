import { buildLegalPageMetadata, renderLegalPage } from "@/lib/legal/page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: "en" | "zh" }>;
}) {
  const { locale } = await params;
  return buildLegalPageMetadata({ locale, slug: "privacy" });
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: "en" | "zh" }>;
}) {
  const { locale } = await params;
  return renderLegalPage(locale, "privacy");
}
