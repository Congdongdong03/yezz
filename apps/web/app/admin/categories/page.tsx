"use client";

import { useEffect, useState } from "react";
import AlertBanner from "@/components/admin/AlertBanner";
import { LocalizedFields } from "@/components/admin/LocalizedFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCategory, deleteCategory, getAdminCategories, updateCategory } from "@/lib/admin/api";
import type { Category } from "@/lib/admin/types";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newCat, setNewCat] = useState<{
    name: { en: string; zh: string };
    slug: string;
    description: { en: string; zh: string };
    icon: string;
    sortOrder: number;
  }>({
    name: { en: "", zh: "" },
    slug: "",
    description: { en: "", zh: "" },
    icon: "",
    sortOrder: 0,
  });

  const load = () => {
    setLoading(true);
    getAdminCategories()
      .then(setCategories)
      .catch((err) => setMessage({ type: "error", text: err instanceof Error ? err.message : "加载失败" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const updateField = (id: string, patch: Partial<Category>) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const save = async (cat: Category) => {
    setSavingId(cat.id);
    setMessage(null);
    try {
      await updateCategory(cat.id, {
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        sortOrder: cat.sortOrder,
      });
      setMessage({ type: "success", text: `已保存：${cat.name.zh}` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "保存失败" });
    } finally {
      setSavingId(null);
    }
  };

  const handleCreate = async () => {
    setMessage(null);
    try {
      const created = await createCategory({
        name: newCat.name,
        slug: newCat.slug,
        description: newCat.description.en || newCat.description.zh ? newCat.description : null,
        icon: newCat.icon || null,
        sortOrder: newCat.sortOrder,
      });
      setCategories((prev) => [...prev, created]);
      setMessage({ type: "success", text: `分类「${created.name.zh}」已创建` });
      setNewCat({ name: { en: "", zh: "" }, slug: "", description: { en: "", zh: "" }, icon: "", sortOrder: 0 });
      setShowCreate(false);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "创建失败" });
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!confirm(`确定删除分类「${cat.name.zh}」？若该分类下有关联项目将无法删除。`)) return;
    setMessage(null);
    try {
      await deleteCategory(cat.id);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      setMessage({ type: "success", text: `已删除：${cat.name.zh}` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "删除失败" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">分类</h1>
        <p className="text-sm text-muted-foreground">编辑名称、图标与排序（slug 来自 seed）</p>
      </div>

      {message && <AlertBanner type={message.type} message={message.text} onDismiss={() => setMessage(null)} />}

      <Button variant="outline" onClick={() => setShowCreate((v) => !v)}>
        {showCreate ? "取消新建" : "+ 新建分类"}
      </Button>

      {showCreate && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium">新建分类</h2>
          <LocalizedFields label="名称" value={newCat.name} onChange={(name) => setNewCat({ ...newCat, name })} />
          <div className="space-y-1.5">
            <Label>Slug（英文唯一标识）</Label>
            <Input value={newCat.slug} onChange={(e) => setNewCat({ ...newCat, slug: e.target.value })} placeholder="e.g. painting" />
          </div>
          <LocalizedFields label="描述" value={newCat.description} onChange={(description) => setNewCat({ ...newCat, description })} multiline />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>图标 (lucide 名)</Label>
              <Input value={newCat.icon} onChange={(e) => setNewCat({ ...newCat, icon: e.target.value })} placeholder="palette" />
            </div>
            <div className="space-y-1.5">
              <Label>排序</Label>
              <Input type="number" value={newCat.sortOrder} onChange={(e) => setNewCat({ ...newCat, sortOrder: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <Button onClick={handleCreate}>创建分类</Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => (
            <div key={cat.id} className="space-y-4 rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">slug: {cat.slug}</p>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(cat)}>
                  删除
                </Button>
              </div>
              <LocalizedFields label="名称" value={cat.name} onChange={(name) => updateField(cat.id, { name })} />
              <LocalizedFields
                label="描述"
                value={cat.description ?? { en: "", zh: "" }}
                onChange={(description) => updateField(cat.id, { description })}
                multiline
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>图标 (lucide 名)</Label>
                  <Input value={cat.icon ?? ""} onChange={(e) => updateField(cat.id, { icon: e.target.value })} placeholder="palette" />
                </div>
                <div className="space-y-1.5">
                  <Label>排序</Label>
                  <Input
                    type="number"
                    value={cat.sortOrder}
                    onChange={(e) =>
                      updateField(cat.id, {
                        sortOrder: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <Button size="sm" disabled={savingId === cat.id} onClick={() => save(cat)}>
                {savingId === cat.id ? "保存中…" : "保存"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
