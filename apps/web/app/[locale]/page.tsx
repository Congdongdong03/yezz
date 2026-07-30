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
import { EmptyCatalogueState } from "@/components/EmptyCatalogueState";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  filterPublishableGalleryImages,
  YEZYY_BUSINESS_PROFILE,
} from "@/lib/site/business";

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
  const { locale } = await params;

  const homeResult = await loadHomePageData();

  if (!homeResult.ok) {
    return <ServiceUnavailable />;
  }

  const { projects, parties, galleryImages, storeImage, siteSettings } =
    homeResult.data;
  const publishableGalleryImages = filterPublishableGalleryImages(galleryImages);
  const emptyStateProps = {
    locale: locale as "en" | "zh",
    phone: YEZYY_BUSINESS_PROFILE.phone,
    email: YEZYY_BUSINESS_PROFILE.email,
  };

  return (
    <>
      <Hero
        heroImageUrl={siteSettings?.heroImageUrl}
        experienceEnabled={siteSettings.requestCapabilities.experience}
      />
      <SceneEntry />
      {projects.length > 0 ? (
        <FeaturedProjects projects={projects} />
      ) : (
        <div className="bg-cream px-4 py-8">
          <EmptyCatalogueState {...emptyStateProps} kind="projects" />
        </div>
      )}
      <WhyDIY />
      {parties.length > 0 ? (
        <PartyPackagesPreview packages={parties} />
      ) : (
        <div className="bg-white px-4 py-8">
          <EmptyCatalogueState {...emptyStateProps} kind="parties" />
        </div>
      )}
      {publishableGalleryImages.length > 0 ? (
        <GalleryHighlight images={publishableGalleryImages} />
      ) : (
        <div className="bg-cream px-4 py-8">
          <EmptyCatalogueState {...emptyStateProps} kind="gallery" />
        </div>
      )}
      <StoreVibes storeImage={storeImage} />
      {siteSettings?.wechatId && <WeChatCTA wechatId={siteSettings.wechatId} />}
    </>
  );
}
