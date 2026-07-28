"use client";

import { useState } from "react";
import AlertBanner from "@/components/admin/AlertBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeMyPassword } from "@/lib/admin/api";

export default function AdminAccountPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 12) {
      setMessage({ type: "error", text: "新密码至少需要 12 个字符" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "两次输入的新密码不一致" });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await changeMyPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ type: "success", text: "密码已更新，请妥善保管。" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "修改密码失败，请稍后重试",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">账户安全</h1>
        <p className="mt-1 text-sm text-muted-foreground">登录后请及时将临时密码改为仅自己知道的密码。</p>
      </div>

      {message && (
        <AlertBanner type={message.type} message={message.text} onDismiss={() => setMessage(null)} />
      )}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div>
          <Label htmlFor="current-password">当前密码</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="new-password">新密码</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">至少 12 个字符。</p>
        </div>
        <div>
          <Label htmlFor="confirm-password">确认新密码</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "保存中…" : "更新密码"}
        </Button>
      </form>
    </div>
  );
}
