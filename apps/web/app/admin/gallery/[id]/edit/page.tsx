"use client";

import { useEffect, useState } from "react";
import GalleryForm from "@/components/admin/GalleryForm";
import { getAdminGalleryImage } from "@/lib/admin/api";
import type { GalleryImage } from "@/lib/admin/types";

export default function EditGalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [image, setImage] = useState<GalleryImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    getAdminGalleryImage(id)
      .then(setImage)
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"));
  }, [id]);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">编辑画廊图片</h1>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!error && !image && <p className="text-sm text-muted-foreground">加载中…</p>}
      {image && <GalleryForm image={image} />}
    </div>
  );
}
