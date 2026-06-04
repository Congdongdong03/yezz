"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AlertBanner from "@/components/admin/AlertBanner";
import { Button } from "@/components/ui/button";
import { deleteParty, getAdminParties } from "@/lib/admin/api";
import type { PartyPackage } from "@/lib/admin/types";

export default function AdminPartiesPage() {
  const [items, setItems] = useState<PartyPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const load = () => {
    setLoading(true);
    getAdminParties()
      .then(setItems)
      .catch((err) =>
        setMessage({ type: "error", text: err instanceof Error ? err.message : "加载失败" }),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除「${name}」？`)) return;
    try {
      await deleteParty(id);
      setMessage({ type: "success", text: "已删除" });
      load();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "删除失败",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">派对套餐</h1>
          <p className="text-sm text-muted-foreground">管理派对/活动套餐</p>
        </div>
        <Button asChild>
          <Link href="/admin/parties/new">新建套餐</Link>
        </Button>
      </div>

      {message && (
        <AlertBanner
          type={message.type}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无套餐</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">名称</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">人数</th>
                <th className="px-4 py-3 font-medium">排序</th>
                <th className="px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{p.name.zh}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.slug}</td>
                  <td className="px-4 py-3">
                    {p.minPeople}–{p.maxPeople}
                  </td>
                  <td className="px-4 py-3">{p.sortOrder}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/parties/${p.id}/edit`}>编辑</Link>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(p.id, p.name.zh)}
                      >
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
