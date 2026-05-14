import { client } from "@/lib/sanity/client";
import { projectsQuery } from "@/lib/sanity/queries";
import ProjectCard from "@/components/projects/ProjectCard";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const projects = await client.fetch(projectsQuery);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <h1 className="text-3xl font-serif font-bold text-warm-charcoal md:text-4xl">
        Our DIY Projects
      </h1>
      <p className="mt-4 text-warm-grey">Explore our creative experiences</p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project: { _id: string; name: { en: string; zh: string }; imageUrl?: string; priceRange?: string; duration?: string; tags?: string[] }) => (
          <ProjectCard key={project._id} project={project} locale={locale} />
        ))}
      </div>
    </div>
  );
}
