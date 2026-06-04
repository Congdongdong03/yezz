import { loadHomePageData } from "@/lib/site/data";
import { buildPageMetadata } from "@/lib/site/metadata";
import ServiceUnavailable from "@/components/ServiceUnavailable";
import Hero from "@/components/sections/Hero";
import SceneEntry from "@/components/sections/SceneEntry";
import FeaturedProjects from "@/components/sections/FeaturedProjects";
import WhyDIY from "@/components/sections/WhyDIY";
import PartyPackagesPreview from "@/components/sections/PartyPackagesPreview";
import GalleryHighlight from "@/components/sections/GalleryHighlight";
import StoreVibes from "@/components/sections/StoreVibes";
import WeChatCTA from "@/components/sections/WeChatCTA";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return buildPageMetadata({
    description: t("description"),
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const _params = await params;
  void _params;

  const homeResult = await loadHomePageData();

  if (!homeResult.ok) {
    return <ServiceUnavailable />;
  }

  const { projects, parties, galleryImages, storeImage, siteSettings } =
    homeResult.data;

  return (
    <>
      <Hero heroImageUrl={siteSettings?.heroImageUrl} />
      <SceneEntry />
      <FeaturedProjects projects={(projects as any[]) || []} />
      <WhyDIY />
      <PartyPackagesPreview packages={(parties as any[]) || []} />
      <GalleryHighlight images={(galleryImages as any[]) || []} />
      <StoreVibes storeImage={(storeImage as any) || null} />
      <WeChatCTA wechatId={siteSettings?.wechatId} />
    </>
  );
}
