"use client";

import { useEffect, useState } from "react";
import ProjectForm from "@/components/admin/ProjectForm";
import { getAdminCategories, getAdminProject } from "@/lib/admin/api";
import type { Category, ProjectDetail } from "@/lib/admin/types";

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    Promise.all([getAdminProject(id), getAdminCategories()])
      .then(([proj, cats]) => {
        setProject(proj);
        setCategories(cats);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"));
  }, [id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">编辑项目</h1>
        {project && (
          <p className="text-sm text-muted-foreground">{project.slug}</p>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!error && (!project || categories.length === 0) && (
        <p className="text-sm text-muted-foreground">加载中…</p>
      )}
      {project && categories.length > 0 && (
        <ProjectForm categories={categories} project={project} />
      )}
    </div>
  );
}
