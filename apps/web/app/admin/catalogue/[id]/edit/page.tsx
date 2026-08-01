"use client";

import { useEffect, useState } from "react";
import CatalogueForm from "@/components/admin/CatalogueForm";
import { getAdminCatalogueEntry, getAdminCategories, getAdminProjects } from "@/lib/admin/api";
import type { AdminCatalogueEntry, Category, ProjectListItem } from "@/lib/admin/types";

export default function EditCatalogueEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const [data, setData] = useState<{ entry: AdminCatalogueEntry; categories: Category[]; projects: ProjectListItem[] } | null>(null);
  useEffect(() => { params.then(({ id }) => Promise.all([getAdminCatalogueEntry(id), getAdminCategories(), getAdminProjects()])).then(([entry, categories, projects]) => setData({ entry, categories, projects: projects.items })); }, [params]);
  if (!data) return <p className="text-sm text-muted-foreground">加载中…</p>;
  return <div className="space-y-6"><div><h1 className="font-serif text-2xl font-semibold">编辑公开项目展示</h1><p className="text-sm text-muted-foreground">修改后不会改变预约项目的营业规则。</p></div><CatalogueForm entry={data.entry} categories={data.categories} projects={data.projects} /></div>;
}
