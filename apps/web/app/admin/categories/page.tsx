"use client";

import { useEffect, useState } from "react";
import AlertBanner from "@/components/admin/AlertBanner";
import { LocalizedFields } from "@/components/admin/LocalizedFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAdminCategories, updateCategory } from "@/lib/admin/api";
import type { Category } from "@/lib/admin/types";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const load = () => {
    setLoading(true);
    getAdminCategories()
      .then(setCategories)
      .catch((err) =>
        setMessage({ type: "error", text: err instanceof Error ? err.message : "加载失败" }),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const updateField = (id: string, patch: Partial<Category>) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
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
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "保存失败",
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">分类</h1>
        <p className="text-sm text-muted-foreground">编辑名称、图标与排序（slug 来自 seed）</p>
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
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="space-y-4 rounded-xl border border-border bg-card p-5"
            >
              <p className="text-xs text-muted-foreground">slug: {cat.slug}</p>
              <LocalizedFields
                label="名称"
                value={cat.name}
                onChange={(name) => updateField(cat.id, { name })}
              />
              <LocalizedFields
                label="描述"
                value={cat.description ?? { en: "", zh: "" }}
                onChange={(description) => updateField(cat.id, { description })}
                multiline
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>图标 (lucide 名)</Label>
                  <Input
                    value={cat.icon ?? ""}
                    onChange={(e) => updateField(cat.id, { icon: e.target.value })}
                    placeholder="palette"
                  />
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
              <Button
                size="sm"
                disabled={savingId === cat.id}
                onClick={() => save(cat)}
              >
                {savingId === cat.id ? "保存中…" : "保存"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
