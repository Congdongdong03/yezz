import { notFound } from "next/navigation";
import { client } from "@/lib/sanity/client";
import { projectDetailQuery } from "@/lib/sanity/queries";
import { mockProjects } from "@/lib/sanity/mock-data";
import ProjectDetail from "@/components/projects/ProjectDetail";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const name = slug.replace(/-/g, " ");
  return {
    title: `${name.charAt(0).toUpperCase() + name.slice(1)} | YEZZ`,
    description: `Learn more about this DIY project at YEZZ Studio. Book your experience today.`,
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  let project: any = null;
  try {
    project = await client.fetch(projectDetailQuery, { slug });
  } catch {
    // Sanity unreachable
  }

  if (!project) {
    project = mockProjects.find((p) => p.slug.current === slug) || null;
  }

  if (!project) {
    notFound();
  }

  return <ProjectDetail project={project} locale={locale} />;
}
