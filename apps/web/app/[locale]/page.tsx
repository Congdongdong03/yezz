import { loadHomePageData } from "@/lib/site/data";
import { buildPageMetadata } from "@/lib/site/metadata";
import ServiceUnavailable from "@/components/ServiceUnavailable";
import Hero from "@/components/sections/Hero";
import PartyPackagesPreview from "@/components/sections/PartyPackagesPreview";
import GalleryHighlight from "@/components/sections/GalleryHighlight";
import WeChatCTA from "@/components/sections/WeChatCTA";
import StudioConfidenceStrip from "@/components/sections/StudioConfidenceStrip";
import StudioProcess from "@/components/sections/StudioProcess";
import EditorialProjects from "@/components/sections/EditorialProjects";
import StudioVisitPreview from "@/components/sections/StudioVisitPreview";
import CatalogueCategoryGrid from "@/components/catalogue/CatalogueCategoryGrid";
import { loadCataloguePageData } from "@/lib/catalogue/data";
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

  const [homeResult, catalogueResult] = await Promise.all([
    loadHomePageData(),
    loadCataloguePageData(),
  ]);

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
      <StudioConfidenceStrip />
      {catalogueResult.ok && catalogueResult.data.length > 0 ? (
        <CatalogueCategoryGrid entries={catalogueResult.data} locale={locale} />
      ) : projects.length > 0 ? (
        <EditorialProjects projects={projects.slice(0, 3)} />
      ) : (
        <div className="bg-cream px-4 py-8">
          <EmptyCatalogueState {...emptyStateProps} kind="projects" />
        </div>
      )}
      <StudioProcess locale={locale as "en" | "zh"} />
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
      <StudioVisitPreview storeImage={storeImage} />
      {siteSettings?.wechatId && <WeChatCTA wechatId={siteSettings.wechatId} />}
    </>
  );
}
