"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AlertBanner from "@/components/admin/AlertBanner";
import ImageUploadField from "@/components/admin/ImageUploadField";
import { LocalizedFields } from "@/components/admin/LocalizedFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProject, updateProject } from "@/lib/admin/api";
import type { Category, ProjectDetail, ProjectFormInput } from "@/lib/admin/types";

const emptyLocalized = { en: "", zh: "" };

function defaultForm(): ProjectFormInput {
  return {
    categoryId: "",
    name: { ...emptyLocalized },
    slug: "",
    projectType: "product",
    description: { ...emptyLocalized },
    priceRange: "",
    duration: "",
    tags: [],
    sortOrder: 0,
    coverImageUrl: "",
    styles: [],
    images: [],
  };
}

function fromProject(project: ProjectDetail): ProjectFormInput {
  return {
    categoryId: project.category.id,
    name: project.name,
    slug: project.slug,
    projectType: project.projectType,
    description: project.description ?? { ...emptyLocalized },
    priceRange: project.priceRange ?? "",
    duration: project.duration ?? "",
    tags: project.tags ?? [],
    sortOrder: project.sortOrder,
    coverImageUrl: project.coverImageUrl ?? "",
    styles: project.styles.map((s) => ({
      name: s.name,
      imageUrl: s.imageUrl,
      price: s.price,
      sortOrder: s.sortOrder,
    })),
    images: project.images.map((img) => ({
      url: img.url,
      sortOrder: img.sortOrder,
    })),
  };
}

export default function ProjectForm({
  categories,
  project,
}: {
  categories: Category[];
  project?: ProjectDetail;
}) {
  const router = useRouter();
  const isEdit = Boolean(project);
  const [form, setForm] = useState<ProjectFormInput>(
    project ? fromProject(project) : defaultForm(),
  );
  const [tagsText, setTagsText] = useState((project?.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: ProjectFormInput = {
      ...form,
      tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      description: form.description?.en || form.description?.zh ? form.description : null,
      priceRange: form.priceRange || null,
      duration: form.duration || null,
      coverImageUrl: form.coverImageUrl || null,
    };

    try {
      if (isEdit && project) {
        await updateProject(project.id, payload);
        router.push("/admin/projects");
        router.refresh();
      } else {
        await createProject(payload);
        router.push("/admin/projects");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6">
      {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}

      <div className="space-y-1.5">
        <Label htmlFor="categoryId">分类</Label>
        <select
          id="categoryId"
          required
          value={form.categoryId}
          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
        >
          <option value="">选择分类</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name.zh} ({c.slug})
            </option>
          ))}
        </select>
      </div>

      <LocalizedFields
        label="名称"
        value={form.name}
        onChange={(name) => setForm({ ...form, name })}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            required
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="projectType">类型</Label>
          <select
            id="projectType"
            value={form.projectType}
            onChange={(e) =>
              setForm({
                ...form,
                projectType: e.target.value as "experience" | "product",
              })
            }
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="product">产品 product</option>
            <option value="experience">体验 experience</option>
          </select>
        </div>
      </div>

      <LocalizedFields
        label="描述"
        value={form.description ?? emptyLocalized}
        onChange={(description) => setForm({ ...form, description })}
        multiline
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="priceRange">价格区间</Label>
          <Input
            id="priceRange"
            value={form.priceRange ?? ""}
            onChange={(e) => setForm({ ...form, priceRange: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="duration">时长</Label>
          <Input
            id="duration"
            value={form.duration ?? ""}
            onChange={(e) => setForm({ ...form, duration: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tags">标签（逗号分隔）</Label>
          <Input id="tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
        </div>
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
      </div>

      <ImageUploadField
        id="coverImageUrl"
        label="封面图"
        value={form.coverImageUrl ?? ""}
        onChange={(coverImageUrl) => setForm({ ...form, coverImageUrl })}
      />

      <fieldset className="space-y-3 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium">款式 Styles</legend>
        {form.styles.map((style, index) => (
          <div key={index} className="space-y-3 rounded-lg bg-muted/50 p-3">
            <LocalizedFields
              label="款式名"
              value={style.name}
              onChange={(name) => {
                const styles = [...form.styles];
                styles[index] = { ...styles[index], name };
                setForm({ ...form, styles });
              }}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>价格</Label>
                <Input
                  value={style.price ?? ""}
                  onChange={(e) => {
                    const styles = [...form.styles];
                    styles[index] = { ...styles[index], price: e.target.value };
                    setForm({ ...form, styles });
                  }}
                />
              </div>
              <ImageUploadField
                label="款式图片"
                value={style.imageUrl ?? ""}
                onChange={(imageUrl) => {
                  const styles = [...form.styles];
                  styles[index] = { ...styles[index], imageUrl };
                  setForm({ ...form, styles });
                }}
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() =>
                setForm({
                  ...form,
                  styles: form.styles.filter((_, i) => i !== index),
                })
              }
            >
              删除款式
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setForm({
              ...form,
              styles: [
                ...form.styles,
                { name: { en: "", zh: "" }, price: "", imageUrl: "" },
              ],
            })
          }
        >
          + 添加款式
        </Button>
      </fieldset>

      <fieldset className="space-y-3 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium">图集 Images</legend>
        {form.images.map((image, index) => (
          <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <ImageUploadField
                label={`图集 #${index + 1}`}
                value={image.url}
                onChange={(url) => {
                  const images = [...form.images];
                  images[index] = { ...images[index], url };
                  setForm({ ...form, images });
                }}
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() =>
                setForm({
                  ...form,
                  images: form.images.filter((_, i) => i !== index),
                })
              }
            >
              删除
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setForm({ ...form, images: [...form.images, { url: "" }] })}
        >
          + 添加图片
        </Button>
      </fieldset>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "保存中…" : isEdit ? "保存修改" : "创建项目"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          取消
        </Button>
      </div>
    </form>
  );
}
