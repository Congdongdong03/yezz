import { loadHomePageData } from "@/lib/site/data";
import Hero from "@/components/sections/Hero";
import SceneEntry from "@/components/sections/SceneEntry";
import FeaturedProjects from "@/components/sections/FeaturedProjects";
import WhyDIY from "@/components/sections/WhyDIY";
import PartyPackagesPreview from "@/components/sections/PartyPackagesPreview";
import GalleryHighlight from "@/components/sections/GalleryHighlight";
import StoreVibes from "@/components/sections/StoreVibes";
import WeChatCTA from "@/components/sections/WeChatCTA";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "YEZZ DIY Studio — Create Your Own Masterpiece",
    description:
      "A cozy DIY studio for dates, birthdays, and gatherings. Book your creative experience today.",
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const _params = await params;
  void _params;

  const { projects, parties, galleryImages, storeImage, siteSettings } =
    await loadHomePageData();

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
