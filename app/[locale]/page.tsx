import { client } from "@/lib/sanity/client";
import {
  featuredProjectsQuery,
  featuredPartiesQuery,
  galleryHighlightQuery,
  storeVibesQuery,
} from "@/lib/sanity/queries";
import Hero from "@/components/sections/Hero";
import SceneEntry from "@/components/sections/SceneEntry";
import FeaturedProjects from "@/components/sections/FeaturedProjects";
import WhyDIY from "@/components/sections/WhyDIY";
import PartyPackagesPreview from "@/components/sections/PartyPackagesPreview";
import GalleryHighlight from "@/components/sections/GalleryHighlight";
import StoreVibes from "@/components/sections/StoreVibes";
import WeChatCTA from "@/components/sections/WeChatCTA";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const _params = await params;
  void _params;

  const [projects, parties, galleryImages, storeImage] = await Promise.all([
    client.fetch(featuredProjectsQuery),
    client.fetch(featuredPartiesQuery),
    client.fetch(galleryHighlightQuery),
    client.fetch(storeVibesQuery),
  ]);

  return (
    <>
      <Hero />
      <SceneEntry />
      <FeaturedProjects projects={projects || []} />
      <WhyDIY />
      <PartyPackagesPreview packages={parties || []} />
      <GalleryHighlight images={galleryImages || []} />
      <StoreVibes storeImage={storeImage || null} />
      <WeChatCTA />
    </>
  );
}
