import { client } from "@/lib/sanity/client";
import { projectDetailQuery } from "@/lib/sanity/queries";
import { mockProjects } from "@/lib/sanity/mock-data";
import ProjectDetail from "@/components/projects/ProjectDetail";

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
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-warm-grey">Project not found</p>
      </div>
    );
  }

  return <ProjectDetail project={project} locale={locale} />;
}
