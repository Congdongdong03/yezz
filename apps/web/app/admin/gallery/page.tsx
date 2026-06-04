"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AlertBanner from "@/components/admin/AlertBanner";
import { Button } from "@/components/ui/button";
import { deleteGalleryImage, getAdminGallery } from "@/lib/admin/api";
import type { GalleryImage } from "@/lib/admin/types";

export default function AdminGalleryPage() {
  const [items, setItems] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const load = () => {
    setLoading(true);
    getAdminGallery()
      .then(setItems)
      .catch((err) =>
        setMessage({ type: "error", text: err instanceof Error ? err.message : "加载失败" }),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除这张图片？")) return;
    try {
      await deleteGalleryImage(id);
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
          <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">画廊</h1>
          <p className="text-sm text-muted-foreground">管理官网画廊图片</p>
        </div>
        <Button asChild>
          <Link href="/admin/gallery/new">添加图片</Link>
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
        <p className="text-sm text-muted-foreground">暂无图片</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((img) => (
            <div key={img.id} className="rounded-xl border border-border bg-card p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.imageUrl}
                alt=""
                className="aspect-square w-full rounded-lg object-cover"
              />
              <p className="mt-2 text-sm font-medium">{img.category}</p>
              <p className="text-xs text-muted-foreground">排序 {img.sortOrder}</p>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/gallery/${img.id}/edit`}>编辑</Link>
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(img.id)}>
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
