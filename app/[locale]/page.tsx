import { client } from "@/lib/sanity/client";
import {
  featuredProjectsQuery,
  featuredPartiesQuery,
  galleryHighlightQuery,
  storeVibesQuery,
  siteSettingsQuery,
} from "@/lib/sanity/queries";
import {
  mockProjects,
  mockParties,
  mockGalleryImages,
  mockStoreImage,
} from "@/lib/sanity/mock-data";
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
    description: "A cozy DIY studio for dates, birthdays, and gatherings. Book your creative experience today.",
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const _params = await params;
  void _params;

  let projects: unknown[] = [];
  let parties: unknown[] = [];
  let galleryImages: unknown[] = [];
  let storeImage: unknown = null;
  let siteSettings: { wechatId?: string; heroImageUrl?: string } | null = null;

  try {
    [projects, parties, galleryImages, storeImage, siteSettings] = await Promise.all([
      client.fetch(featuredProjectsQuery),
      client.fetch(featuredPartiesQuery),
      client.fetch(galleryHighlightQuery),
      client.fetch(storeVibesQuery),
      client.fetch(siteSettingsQuery),
    ]);
  } catch {
    // Sanity unreachable — will fall through to empty checks below
  }

  // Fallback to mock data when Sanity returns empty or errors
  if (!projects || (projects as any[]).length === 0) projects = mockProjects;
  if (!parties || (parties as any[]).length === 0) parties = mockParties;
  if (!galleryImages || (galleryImages as any[]).length === 0)
    galleryImages = mockGalleryImages;
  if (!storeImage) storeImage = mockStoreImage;

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
