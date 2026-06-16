"use client";

import { useEffect, useState } from "react";
import ProjectForm from "@/components/admin/ProjectForm";
import { getAdminCategories, getAdminProject } from "@/lib/admin/api";
import { useResolvedId } from "@/lib/admin/hooks";
import type { Category, ProjectDetail } from "@/lib/admin/types";

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const id = useResolvedId(params);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

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
      {!error && !project && (
        <p className="text-sm text-muted-foreground">加载中…</p>
      )}
      {project && categories.length === 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">暂无分类，请先创建分类后再编辑项目。</p>
          <a href="/admin/categories" className="text-sm text-primary underline-offset-2 hover:underline">→ 去创建分类</a>
        </div>
      )}
      {project && categories.length > 0 && (
        <ProjectForm categories={categories} project={project} />
      )}
    </div>
  );
}
