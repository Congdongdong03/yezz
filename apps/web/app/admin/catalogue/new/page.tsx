"use client";

import { useEffect, useState } from "react";
import CatalogueForm from "@/components/admin/CatalogueForm";
import { getAdminCategories, getAdminProjects } from "@/lib/admin/api";
import type { Category, ProjectListItem } from "@/lib/admin/types";

export default function NewCatalogueEntryPage() {
  const [data, setData] = useState<{ categories: Category[]; projects: ProjectListItem[] } | null>(null);
  useEffect(() => { Promise.all([getAdminCategories(), getAdminProjects()]).then(([categories, projects]) => setData({ categories, projects: projects.items })); }, []);
  if (!data) return <p className="text-sm text-muted-foreground">加载中…</p>;
  return <div className="space-y-6"><div><h1 className="font-serif text-2xl font-semibold">新建公开项目展示</h1><p className="text-sm text-muted-foreground">建立顾客可读的项目故事，并关联真实价格项目。</p></div><CatalogueForm categories={data.categories} projects={data.projects} /></div>;
}
