import { buildLegalPageMetadata, renderLegalPage } from "@/lib/legal/page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: "en" | "zh" }>;
}) {
  const { locale } = await params;
  return buildLegalPageMetadata({ locale, slug: "cancellation-rescheduling" });
}

export default async function CancellationReschedulingPage({
  params,
}: {
  params: Promise<{ locale: "en" | "zh" }>;
}) {
  const { locale } = await params;
  return renderLegalPage(locale, "cancellation-rescheduling");
}
