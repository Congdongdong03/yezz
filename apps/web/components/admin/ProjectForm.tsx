"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AlertBanner from "@/components/admin/AlertBanner";
import DynamicArrayField from "@/components/admin/DynamicArrayField";
import ImageUploadField from "@/components/admin/ImageUploadField";
import { LocalizedFields } from "@/components/admin/LocalizedFields";
import { AdminSelect } from "@/components/ui/admin-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProject, updateProject } from "@/lib/admin/api";
import { emptyLocalized } from "@/lib/admin/constants";
import { useFormSubmit } from "@/lib/admin/hooks";
import { useTagsInput } from "@/lib/admin/use-tags-input";
import type { Category, ProjectDetail, ProjectFormInput } from "@/lib/admin/types";

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
  const isEdit = Boolean(project);
  const [form, setForm] = useState<ProjectFormInput>(
    project ? fromProject(project) : defaultForm(),
  );
  const { tagsText, setTagsText, parseTags } = useTagsInput(project?.tags);
  const router = useRouter();
  const { saving, error, clearError, handleSubmit } = useFormSubmit({ redirectTo: "/admin/projects" });

  const submit = handleSubmit(async () => {
    const payload: ProjectFormInput = {
      ...form,
      tags: parseTags(),
      description: form.description?.en || form.description?.zh ? form.description : null,
      priceRange: form.priceRange || null,
      duration: form.duration || null,
      coverImageUrl: form.coverImageUrl || null,
    };

    if (isEdit && project) {
      await updateProject(project.id, payload);
    } else {
      await createProject(payload);
    }
  });

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6">
      {error && <AlertBanner type="error" message={error} onDismiss={clearError} />}

      <AdminSelect
        id="categoryId"
        label="分类"
        required
        value={form.categoryId}
        placeholder="选择分类"
        options={categories.map((c) => ({ value: c.id, label: `${c.name.zh} (${c.slug})` }))}
        onChange={(categoryId) => setForm({ ...form, categoryId })}
      />

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
        <AdminSelect
          id="projectType"
          label="类型"
          value={form.projectType}
          options={[
            { value: "product", label: "产品 product" },
            { value: "experience", label: "体验 experience" },
          ]}
          onChange={(v) => setForm({ ...form, projectType: v as "experience" | "product" })}
        />
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

      <DynamicArrayField
        legend="款式 Styles"
        items={form.styles}
        addLabel="+ 添加款式"
        onAdd={() =>
          setForm({
            ...form,
            styles: [
              ...form.styles,
              { name: { en: "", zh: "" }, price: "", imageUrl: "" },
            ],
          })
        }
        renderItem={(_, index) => (
          <div className="space-y-3 rounded-lg bg-muted/50 p-3">
            <LocalizedFields
              label="款式名"
              value={form.styles[index].name}
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
                  value={form.styles[index].price ?? ""}
                  onChange={(e) => {
                    const styles = [...form.styles];
                    styles[index] = { ...styles[index], price: e.target.value };
                    setForm({ ...form, styles });
                  }}
                />
              </div>
              <ImageUploadField
                label="款式图片"
                value={form.styles[index].imageUrl ?? ""}
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
        )}
      />

      <DynamicArrayField
        legend="图集 Images"
        items={form.images}
        addLabel="+ 添加图片"
        onAdd={() => setForm({ ...form, images: [...form.images, { url: "" }] })}
        renderItem={(_, index) => (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <ImageUploadField
                label={`图集 #${index + 1}`}
                value={form.images[index].url}
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
        )}
      />

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
