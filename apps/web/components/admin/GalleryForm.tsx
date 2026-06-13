"use client";

import { useState } from "react";
import AlertBanner from "@/components/admin/AlertBanner";
import ImageUploadField from "@/components/admin/ImageUploadField";
import { LocalizedFields } from "@/components/admin/LocalizedFields";
import { AdminSelect } from "@/components/ui/admin-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createGalleryImage, updateGalleryImage } from "@/lib/admin/api";
import { emptyLocalized } from "@/lib/admin/constants";
import { useFormSubmit } from "@/lib/admin/hooks";
import type { GalleryFormInput, GalleryImage } from "@/lib/admin/types";

const CATEGORIES = ["couple", "birthday", "kids", "gift", "store", "works"] as const;

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
  const isEdit = Boolean(image);
  const [form, setForm] = useState<GalleryFormInput>(image ? fromImage(image) : defaultForm());
  const { saving, error, clearError, handleSubmit } = useFormSubmit({ redirectTo: "/admin/gallery" });

  const submit = handleSubmit(async () => {
    const payload: GalleryFormInput = {
      ...form,
      caption: form.caption?.en || form.caption?.zh ? form.caption : null,
    };

    if (isEdit && image) {
      await updateGalleryImage(image.id, payload);
    } else {
      await createGalleryImage(payload);
    }
  });

  return (
    <form onSubmit={submit} className="max-w-xl space-y-6">
      {error && <AlertBanner type="error" message={error} onDismiss={clearError} />}

      <ImageUploadField
        label="图片"
        value={form.imageUrl}
        onChange={(imageUrl) => setForm({ ...form, imageUrl })}
      />

      <AdminSelect
        id="category"
        label="分类"
        value={form.category}
        options={CATEGORIES.map((c) => ({ value: c, label: c }))}
        onChange={(category) => setForm({ ...form, category })}
      />

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
