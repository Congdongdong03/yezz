"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AlertBanner from "@/components/admin/AlertBanner";
import ImageUploadField from "@/components/admin/ImageUploadField";
import { LocalizedFields } from "@/components/admin/LocalizedFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createParty, updateParty } from "@/lib/admin/api";
import type { PartyFormInput, PartyPackage } from "@/lib/admin/types";

const emptyLocalized = { en: "", zh: "" };

function defaultForm(): PartyFormInput {
  return {
    name: { ...emptyLocalized },
    slug: "",
    description: { ...emptyLocalized },
    includes: [],
    coverImageUrl: "",
    imageUrls: [],
    minPeople: 2,
    maxPeople: 20,
    priceIndicator: "",
    tags: [],
    sortOrder: 0,
  };
}

function fromParty(party: PartyPackage): PartyFormInput {
  return {
    name: party.name,
    slug: party.slug,
    description: party.description ?? { ...emptyLocalized },
    includes: party.includes,
    coverImageUrl: party.imageUrl ?? "",
    imageUrls: party.imageUrls ?? [],
    minPeople: party.minPeople,
    maxPeople: party.maxPeople,
    priceIndicator: party.priceIndicator ?? "",
    tags: party.tags ?? [],
    sortOrder: party.sortOrder,
  };
}

export default function PartyForm({ party }: { party?: PartyPackage }) {
  const router = useRouter();
  const isEdit = Boolean(party);
  const [form, setForm] = useState<PartyFormInput>(party ? fromParty(party) : defaultForm());
  const [tagsText, setTagsText] = useState((party?.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: PartyFormInput = {
      ...form,
      tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      description: form.description?.en || form.description?.zh ? form.description : null,
      priceIndicator: form.priceIndicator || null,
      coverImageUrl: form.coverImageUrl || null,
      imageUrls: form.imageUrls.filter(Boolean),
    };

    try {
      if (isEdit && party) {
        await updateParty(party.id, payload);
      } else {
        await createParty(payload);
      }
      router.push("/admin/parties");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6">
      {error && <AlertBanner type="error" message={error} onDismiss={() => setError(null)} />}

      <LocalizedFields
        label="名称"
        value={form.name}
        onChange={(name) => setForm({ ...form, name })}
      />

      <div className="space-y-1.5">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          required
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        />
      </div>

      <LocalizedFields
        label="描述"
        value={form.description ?? emptyLocalized}
        onChange={(description) => setForm({ ...form, description })}
        multiline
      />

      <ImageUploadField
        label="封面图"
        value={form.coverImageUrl ?? ""}
        onChange={(coverImageUrl) => setForm({ ...form, coverImageUrl })}
      />

      <fieldset className="space-y-3 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium">包含项 Includes</legend>
        {form.includes.map((item, index) => (
          <div key={index} className="rounded-lg bg-muted/50 p-3">
            <LocalizedFields
              label={`项目 #${index + 1}`}
              value={item}
              onChange={(line) => {
                const includes = [...form.includes];
                includes[index] = line;
                setForm({ ...form, includes });
              }}
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="mt-2"
              onClick={() =>
                setForm({
                  ...form,
                  includes: form.includes.filter((_, i) => i !== index),
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
          onClick={() =>
            setForm({ ...form, includes: [...form.includes, { ...emptyLocalized }] })
          }
        >
          + 添加包含项
        </Button>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="minPeople">最少人数</Label>
          <Input
            id="minPeople"
            type="number"
            value={form.minPeople}
            onChange={(e) =>
              setForm({ ...form, minPeople: Number(e.target.value) || 0 })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="maxPeople">最多人数</Label>
          <Input
            id="maxPeople"
            type="number"
            value={form.maxPeople}
            onChange={(e) =>
              setForm({ ...form, maxPeople: Number(e.target.value) || 0 })
            }
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="priceIndicator">价格说明</Label>
          <Input
            id="priceIndicator"
            value={form.priceIndicator ?? ""}
            onChange={(e) => setForm({ ...form, priceIndicator: e.target.value })}
          />
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

      <div className="space-y-1.5">
        <Label htmlFor="tags">标签（逗号分隔）</Label>
        <Input id="tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "保存中…" : isEdit ? "保存修改" : "创建套餐"}
      </Button>
    </form>
  );
}
