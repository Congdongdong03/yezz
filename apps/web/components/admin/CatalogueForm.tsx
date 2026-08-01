"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AlertBanner from "@/components/admin/AlertBanner";
import ImageUploadField from "@/components/admin/ImageUploadField";
import { LocalizedFields } from "@/components/admin/LocalizedFields";
import { AdminSelect } from "@/components/ui/admin-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCatalogueEntry,
  updateCatalogueEntry,
} from "@/lib/admin/api";
import type {
  AdminCatalogueEntry,
  CatalogueFormInput,
  Category,
  LocalizedString,
  ProjectListItem,
} from "@/lib/admin/types";

const emptyLocalized = (): LocalizedString => ({ en: "", zh: "" });

function defaultForm(): CatalogueFormInput {
  return {
    categoryId: "",
    name: emptyLocalized(),
    slug: "",
    description: emptyLocalized(),
    durationDisplay: emptyLocalized(),
    occasionTags: [],
    availabilityNote: emptyLocalized(),
    published: false,
    featured: false,
    sortOrder: 0,
    coverImageUrl: null,
    imageKind: "placeholder",
    imageSourceUrl: null,
    imageLicenseUrl: null,
    imageAttribution: null,
    variants: [],
  };
}

function fromEntry(entry: AdminCatalogueEntry): CatalogueFormInput {
  return {
    categoryId: entry.categoryId,
    name: entry.name,
    slug: entry.slug,
    description: entry.description,
    durationDisplay: entry.durationDisplay,
    occasionTags: entry.occasionTags,
    availabilityNote: entry.availabilityNote,
    published: entry.published,
    featured: entry.featured,
    sortOrder: entry.sortOrder,
    coverImageUrl: entry.coverImageUrl,
    imageKind: entry.image.kind,
    imageSourceUrl: entry.image.sourceUrl,
    imageLicenseUrl: entry.image.licenseUrl,
    imageAttribution: entry.image.attribution,
    variants: entry.variants.map(({ projectId, label, sortOrder }) => ({
      projectId,
      label,
      sortOrder,
    })),
  };
}

export function buildCataloguePayload(input: CatalogueFormInput): CatalogueFormInput {
  const {
    categoryId,
    name,
    slug,
    description,
    durationDisplay,
    occasionTags,
    availabilityNote,
    published,
    featured,
    sortOrder,
    coverImageUrl,
    imageKind,
    imageSourceUrl,
    imageLicenseUrl,
    imageAttribution,
    variants,
  } = input;

  return {
    categoryId,
    name,
    slug: slug.trim(),
    description,
    durationDisplay,
    occasionTags,
    availabilityNote,
    published,
    featured,
    sortOrder,
    coverImageUrl: coverImageUrl?.trim() || null,
    imageKind,
    imageSourceUrl: imageKind === "inspiration" ? imageSourceUrl?.trim() || null : null,
    imageLicenseUrl: imageKind === "inspiration" ? imageLicenseUrl?.trim() || null : null,
    imageAttribution: imageKind === "inspiration" ? imageAttribution : null,
    variants: variants.map((variant, index) => ({
      projectId: variant.projectId,
      label: variant.label,
      sortOrder: index,
    })),
  };
}

function tagsToText(tags: LocalizedString[]): string {
  return tags.map((tag) => `${tag.en} | ${tag.zh}`).join("\n");
}

function textToTags(value: string): LocalizedString[] {
  return value
    .split("\n")
    .map((line) => line.split("|").map((part) => part.trim()))
    .filter(([en, zh]) => Boolean(en && zh))
    .map(([en, zh]) => ({ en: en!, zh: zh! }));
}

export default function CatalogueForm({
  categories,
  projects,
  entry,
}: {
  categories: Category[];
  projects: ProjectListItem[];
  entry?: AdminCatalogueEntry;
}) {
  const [form, setForm] = useState<CatalogueFormInput>(
    entry ? fromEntry(entry) : defaultForm(),
  );
  const [tagsText, setTagsText] = useState(tagsToText(form.occasionTags));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const toggleProject = (projectId: string) => {
    const selected = form.variants.some((variant) => variant.projectId === projectId);
    setForm({
      ...form,
      variants: selected
        ? form.variants.filter((variant) => variant.projectId !== projectId)
        : [...form.variants, { projectId, label: null, sortOrder: form.variants.length }],
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = buildCataloguePayload({
        ...form,
        occasionTags: textToTags(tagsText),
      });
      if (entry) await updateCatalogueEntry(entry.id, payload);
      else await createCatalogueEntry(payload);
      router.push("/admin/catalogue");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
      setSaving(false);
    }
  };

  return (
    <form className="max-w-4xl space-y-8" onSubmit={submit}>
      {error ? <AlertBanner type="error" message={error} onDismiss={() => setError(null)} /> : null}

      <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
        <h2 className="font-serif text-xl font-semibold">1. 基本信息</h2>
        <div className="mt-5 space-y-5">
          <AdminSelect id="categoryId" label="分类" required value={form.categoryId} placeholder="选择分类" options={categories.map((category) => ({ value: category.id, label: `${category.name.zh} / ${category.name.en}` }))} onChange={(categoryId) => setForm({ ...form, categoryId })} />
          <LocalizedFields label="名称" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <div className="space-y-1.5"><Label htmlFor="catalogue-slug">公开网址 Slug</Label><Input id="catalogue-slug" required value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
        <h2 className="font-serif text-xl font-semibold">2. 中英文介绍</h2>
        <div className="mt-5 space-y-5">
          <LocalizedFields label="公开介绍" multiline value={form.description} onChange={(description) => setForm({ ...form, description })} />
          <LocalizedFields label="时长说明" value={form.durationDisplay} onChange={(durationDisplay) => setForm({ ...form, durationDisplay })} />
          <LocalizedFields label="库存说明" multiline value={form.availabilityNote} onChange={(availabilityNote) => setForm({ ...form, availabilityNote })} />
          <div className="space-y-1.5"><Label htmlFor="occasion-tags">适合场景（每行：English | 中文）</Label><textarea id="occasion-tags" className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={tagsText} onChange={(event) => setTagsText(event.target.value)} /></div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
        <h2 className="font-serif text-xl font-semibold">3. 公开价格来源项目</h2>
        <p className="mt-2 text-sm text-muted-foreground">可选择多个真实项目，公开价格始终从这些项目读取。</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {projects.map((project) => (
            <label key={project.id} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
              <input type="checkbox" checked={form.variants.some((variant) => variant.projectId === project.id)} onChange={() => toggleProject(project.id)} />
              <span><strong>{project.name.en} / {project.name.zh}</strong><span className="mt-1 block text-xs text-muted-foreground">{project.slug}</span></span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
        <h2 className="font-serif text-xl font-semibold">4. 公开排序与状态</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <div className="space-y-1.5"><Label htmlFor="catalogue-order">排序</Label><Input id="catalogue-order" type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) || 0 })} /></div>
          <label className="flex items-center gap-3 rounded-lg border border-border p-4"><input name="published" type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} /><span>已发布</span></label>
          <label className="flex items-center gap-3 rounded-lg border border-border p-4"><input name="featured" type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /><span>首页推荐</span></label>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
        <h2 className="font-serif text-xl font-semibold">5. 图片与来源</h2>
        <div className="mt-5 space-y-5">
          <ImageUploadField id="catalogue-cover" label="封面图" value={form.coverImageUrl ?? ""} onChange={(coverImageUrl) => setForm({ ...form, coverImageUrl })} />
          <AdminSelect id="imageKind" label="图片类型" value={form.imageKind} options={[{ value: "yezyy", label: "YezYY 自有图片" }, { value: "inspiration", label: "灵感图" }, { value: "placeholder", label: "暂未有图片" }]} onChange={(imageKind) => setForm({ ...form, imageKind: imageKind as CatalogueFormInput["imageKind"] })} />
          {form.imageKind === "inspiration" ? <div className="space-y-5 rounded-lg bg-muted/40 p-4"><div className="space-y-1.5"><Label htmlFor="image-source">图片来源网址</Label><Input id="image-source" required value={form.imageSourceUrl ?? ""} onChange={(event) => setForm({ ...form, imageSourceUrl: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="image-license">图片许可网址</Label><Input id="image-license" required value={form.imageLicenseUrl ?? ""} onChange={(event) => setForm({ ...form, imageLicenseUrl: event.target.value })} /></div><LocalizedFields label="图片署名" value={form.imageAttribution ?? emptyLocalized()} onChange={(imageAttribution) => setForm({ ...form, imageAttribution })} /></div> : null}
        </div>
      </section>

      <div className="flex gap-3"><Button type="submit" disabled={saving}>{saving ? "保存中…" : "保存公开展示"}</Button><Button type="button" variant="outline" onClick={() => router.back()}>取消</Button></div>
    </form>
  );
}
