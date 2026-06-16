"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProjectForm from "@/components/admin/ProjectForm";
import { getAdminCategories } from "@/lib/admin/api";
import type { Category } from "@/lib/admin/types";

export default function NewProjectPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
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
        <p className="text-sm text-muted-foreground">填写项目信息并上传图片</p>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : categories === null ? (
        <p className="text-sm text-muted-foreground">加载分类中…</p>
      ) : categories.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">暂无分类，请先创建分类后再新建项目。</p>
          <Link
            href="/admin/categories"
            className="text-sm text-primary underline-offset-2 hover:underline"
          >
            → 去创建分类
          </Link>
        </div>
      ) : (
        <ProjectForm categories={categories} />
      )}
    </div>
  );
}
