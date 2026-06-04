"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AlertBanner from "@/components/admin/AlertBanner";
import ImageUploadField from "@/components/admin/ImageUploadField";
import { LocalizedFields } from "@/components/admin/LocalizedFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createGalleryImage, updateGalleryImage } from "@/lib/admin/api";
import type { GalleryFormInput, GalleryImage } from "@/lib/admin/types";

const CATEGORIES = ["couple", "birthday", "kids", "gift", "store", "works"] as const;
const emptyLocalized = { en: "", zh: "" };

function defaultForm(): GalleryFormInput {
  return {
    imageUrl: "",
    category: "works",
    caption: { ...emptyLocalized },
    sortOrder: 0,
  };
}

function fromImage(image: GalleryImage): GalleryFormInput {
  return {
    imageUrl: image.imageUrl,
    category: image.category,
    caption: image.caption ?? { ...emptyLocalized },
    sortOrder: image.sortOrder,
  };
}

export default function GalleryForm({ image }: { image?: GalleryImage }) {
  const router = useRouter();
  const isEdit = Boolean(image);
  const [form, setForm] = useState<GalleryFormInput>(image ? fromImage(image) : defaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: GalleryFormInput = {
      ...form,
      caption: form.caption?.en || form.caption?.zh ? form.caption : null,
    };

    try {
      if (isEdit && image) {
        await updateGalleryImage(image.id, payload);
      } else {
        await createGalleryImage(payload);
      }
      router.push("/admin/gallery");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-xl space-y-6">
      {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}

      <ImageUploadField
        label="图片"
        value={form.imageUrl}
        onChange={(imageUrl) => setForm({ ...form, imageUrl })}
      />

      <div className="space-y-1.5">
        <Label htmlFor="category">分类</Label>
        <select
          id="category"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <LocalizedFields
        label="说明"
        value={form.caption ?? emptyLocalized}
        onChange={(caption) => setForm({ ...form, caption })}
      />

      <div className="space-y-1.5">
        <Label htmlFor="sortOrder">排序</Label>
        <Input
          id="sortOrder"
          type="number"
          value={form.sortOrder}
          onChange={(e) =>
            setForm({ ...form, sortOrder: Number(e.target.value) || 0 })
          }
        />
      </div>

      <Button type="submit" disabled={saving || !form.imageUrl}>
        {saving ? "保存中…" : isEdit ? "保存修改" : "添加图片"}
      </Button>
    </form>
  );
}
