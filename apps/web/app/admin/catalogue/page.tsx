"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AlertBanner from "@/components/admin/AlertBanner";
import { Button } from "@/components/ui/button";
import { getAdminCatalogue } from "@/lib/admin/api";
import type { AdminCatalogueEntry } from "@/lib/admin/types";

export function CatalogueList({ items }: { items: AdminCatalogueEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-border bg-muted/50 text-muted-foreground"><tr><th className="px-4 py-3">公开名称</th><th className="px-4 py-3">分类</th><th className="px-4 py-3">状态</th><th className="px-4 py-3">价格来源</th><th className="px-4 py-3">排序</th><th className="px-4 py-3 text-right">操作</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id} className="border-b border-border last:border-0"><td className="px-4 py-3"><strong>{item.name.zh}</strong><span className="mt-1 block text-xs text-muted-foreground">{item.name.en} · {item.slug}</span></td><td className="px-4 py-3">{item.category.name.zh}</td><td className="px-4 py-3"><span className={item.published ? "rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800" : "rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700"}>{item.published ? "已发布" : "已隐藏"}</span>{item.featured ? <span className="ml-2 rounded-full bg-pink-100 px-2 py-1 text-xs text-pink-800">首页推荐</span> : null}</td><td className="px-4 py-3">{item.variants.length} 个项目</td><td className="px-4 py-3">{item.sortOrder}</td><td className="px-4 py-3 text-right"><Button variant="outline" size="sm" asChild><Link href={`/admin/catalogue/${item.id}/edit`}>编辑</Link></Button></td></tr>)}</tbody>
      </table>
    </div>
  );
}

export default function AdminCataloguePage() {
  const [items, setItems] = useState<AdminCatalogueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { getAdminCatalogue().then(setItems).catch((cause) => setError(cause instanceof Error ? cause.message : "加载失败")).finally(() => setLoading(false)); }, []);
  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-serif text-2xl font-semibold">公开项目展示</h1><p className="text-sm text-muted-foreground">只控制顾客看到的内容，不改变预约项目规则。</p></div><Button asChild><Link href="/admin/catalogue/new">新建公开展示</Link></Button></div>{error ? <AlertBanner type="error" message={error} onDismiss={() => setError(null)} /> : null}{loading ? <p className="text-sm text-muted-foreground">加载中…</p> : items.length ? <CatalogueList items={items} /> : <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center text-sm text-muted-foreground">还没有公开项目展示。</div>}</div>;
}
