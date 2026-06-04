import { notFound } from "next/navigation";
import ProjectDetail from "@/components/projects/ProjectDetail";
import ServiceUnavailable from "@/components/ServiceUnavailable";
import { loadProjectBySlug } from "@/lib/projects/data";
import { buildPageMetadata } from "@/lib/site/metadata";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const result = await loadProjectBySlug(slug);
  if (!result.ok || !result.data) {
    return buildPageMetadata({ title: slug.replace(/-/g, " ") });
  }
  const name =
    result.data.name?.[locale as "en" | "zh"] ?? slug.replace(/-/g, " ");
  const description =
    result.data.description?.[locale as "en" | "zh"] ??
    result.data.description?.en;
  return buildPageMetadata({
    title: name,
    description: description ?? undefined,
  });
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const result = await loadProjectBySlug(slug);

  if (!result.ok) {
    return <ServiceUnavailable />;
  }

  if (!result.data) {
    notFound();
  }

  return <ProjectDetail project={result.data} locale={locale} />;
}
