"use client";

import { useEffect, useState } from "react";
import ProjectForm from "@/components/admin/ProjectForm";
import { getAdminCategories } from "@/lib/admin/api";
import type { Category } from "@/lib/admin/types";

export default function NewProjectPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminCategories()
      .then(setCategories)
      .catch((err) => setError(err instanceof Error ? err.message : "加载分类失败"));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">新建项目</h1>
        <p className="text-sm text-muted-foreground">图片请填写 URL（P1 无上传）</p>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">加载分类中…</p>
      ) : (
        <ProjectForm categories={categories} />
      )}
    </div>
  );
}
