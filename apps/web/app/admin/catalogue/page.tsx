"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AlertBanner from "@/components/admin/AlertBanner";
import CatalogueList from "@/components/admin/CatalogueList";
import { Button } from "@/components/ui/button";
import { getAdminCatalogue } from "@/lib/admin/api";
import type { AdminCatalogueEntry } from "@/lib/admin/types";

export default function AdminCataloguePage() {
  const [items, setItems] = useState<AdminCatalogueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { getAdminCatalogue().then(setItems).catch((cause) => setError(cause instanceof Error ? cause.message : "加载失败")).finally(() => setLoading(false)); }, []);
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-serif text-2xl font-semibold">公开项目展示</h1><p className="text-sm text-muted-foreground">只控制顾客看到的内容，不改变预约项目规则。</p></div><Button asChild><Link href="/admin/catalogue/new">新建公开展示</Link></Button></div>{error ? <AlertBanner type="error" message={error} onDismiss={() => setError(null)} /> : null}{loading ? <p className="text-sm text-muted-foreground">加载中…</p> : items.length ? <CatalogueList items={items} /> : <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center text-sm text-muted-foreground">还没有公开项目展示。</div>}</div>;
}
