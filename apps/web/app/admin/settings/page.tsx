"use client";

import { useEffect, useState } from "react";
import AlertBanner from "@/components/admin/AlertBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAdminSettings, updateAdminSettings } from "@/lib/admin/api";
import type { SiteSettings } from "@/lib/admin/types";

export default function AdminSettingsPage() {
  const [form, setForm] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  useEffect(() => {
    getAdminSettings()
      .then(setForm)
      .catch((err) =>
        setMessage({ type: "error", text: err instanceof Error ? err.message : "加载失败" }),
      )
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setMessage(null);
    const { id: _id, ...data } = form;
    void _id;
    try {
      const updated = await updateAdminSettings(data);
      setForm(updated);
      setMessage({ type: "success", text: "站点设置已保存" });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "保存失败",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">加载中…</p>;
  }

  if (!form) {
    return (
      <p className="text-sm text-destructive" role="alert">
        无法加载站点设置，请先执行 db:seed
      </p>
    );
  }

  const fields: Array<{
    key: keyof SiteSettings;
    label: string;
    multiline?: boolean;
  }> = [
    { key: "storeName", label: "店铺名称" },
    { key: "address", label: "地址", multiline: true },
    { key: "businessHours", label: "营业时间" },
    { key: "phone", label: "电话" },
    { key: "email", label: "邮箱" },
    { key: "wechatId", label: "微信号" },
    { key: "wechatQrUrl", label: "微信二维码 URL" },
    { key: "heroImageUrl", label: "首页 Hero 图 URL" },
    { key: "instagram", label: "Instagram" },
    { key: "xiaohongshu", label: "小红书" },
    { key: "googleMapUrl", label: "Google 地图链接" },
    { key: "seoTitle", label: "SEO 标题" },
    { key: "seoDescription", label: "SEO 描述", multiline: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">站点设置</h1>
        <p className="text-sm text-muted-foreground">联系信息、社交链接与 SEO</p>
      </div>

      {message && (
        <AlertBanner
          type={message.type}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      )}

      <form onSubmit={submit} className="max-w-2xl space-y-4">
        {fields.map(({ key, label, multiline }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={key}>{label}</Label>
            {multiline ? (
              <textarea
                id={key}
                value={(form[key] as string | null) ?? ""}
                onChange={(e) => set(key, e.target.value || null)}
                className="min-h-[72px] w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
              />
            ) : (
              <Input
                id={key}
                value={(form[key] as string | null) ?? ""}
                onChange={(e) => set(key, e.target.value || null)}
              />
            )}
          </div>
        ))}
        <Button type="submit" disabled={saving}>
          {saving ? "保存中…" : "保存设置"}
        </Button>
      </form>
    </div>
  );
}
