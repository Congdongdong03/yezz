import { notFound } from "next/navigation";
import ProjectDetail from "@/components/projects/ProjectDetail";
import { loadProjectBySlug } from "@/lib/projects/data";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const project = await loadProjectBySlug(slug);
  const name =
    project?.name?.[locale as "en" | "zh"] ??
    slug.replace(/-/g, " ");
  return {
    title: `${name} | YEZZ`,
    description: `Learn more about this DIY project at YEZZ Studio. Book your experience today.`,
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  const project = await loadProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  return <ProjectDetail project={project} locale={locale} />;
}
