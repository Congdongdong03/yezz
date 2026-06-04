"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAdminCategories,
  getAdminProjects,
  getAdminSettings,
} from "@/lib/admin/api";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<{
    projects: number;
    categories: number;
    settingsReady: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getAdminProjects(), getAdminCategories(), getAdminSettings()])
      .then(([projects, categories, settings]) => {
        setStats({
          projects: projects.total,
          categories: categories.length,
          settingsReady: Boolean(settings?.storeName),
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">看板</h1>
        <p className="text-sm text-muted-foreground">Phase 1 内容管理概览</p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{stats?.projects ?? "—"}</CardTitle>
            <CardDescription>DIY 项目</CardDescription>
          </CardHeader>
          <Link href="/admin/projects" className="text-sm text-primary hover:underline">
            管理项目 →
          </Link>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{stats?.categories ?? "—"}</CardTitle>
            <CardDescription>项目分类</CardDescription>
          </CardHeader>
          <Link href="/admin/categories" className="text-sm text-primary hover:underline">
            管理分类 →
          </Link>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {stats?.settingsReady ? "已配置" : "—"}
            </CardTitle>
            <CardDescription>站点设置</CardDescription>
          </CardHeader>
          <Link href="/admin/settings" className="text-sm text-primary hover:underline">
            编辑设置 →
          </Link>
        </Card>
      </div>
    </div>
  );
}
