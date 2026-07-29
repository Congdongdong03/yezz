"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import AlertBanner from "@/components/admin/AlertBanner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completePasswordSetup } from "@/lib/admin/api";

export default function SetupPasswordForm() {
  const searchParams = useSearchParams();
  const [token] = useState(() => searchParams.get("token") ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("token")) return;
    url.searchParams.delete("token");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  if (complete) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>密码已设置</CardTitle>
          <CardDescription>
            Password setup is complete. You can now sign in.
          </CardDescription>
        </CardHeader>
        <Link
          href="/admin/login"
          className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          前往登录
        </Link>
      </Card>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError("密码必须至少 12 个字符 / Password must be at least 12 characters");
      return;
    }
    if (password !== confirmation) {
      setError("两次输入的密码不一致 / Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await completePasswordSetup(token, password);
      setPassword("");
      setConfirmation("");
      setComplete(true);
    } catch {
      setError(
        "此设置链接无效、已过期或已使用 / This setup link is invalid, expired, or already used",
      );
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>设置后台密码</CardTitle>
        <CardDescription>
          Choose a password with at least 12 characters.
        </CardDescription>
      </CardHeader>
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <AlertBanner
            type="error"
            message={error}
            onDismiss={() => setError(null)}
          />
        )}
        <div className="space-y-1.5">
          <Label htmlFor="new-password">新密码</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">确认新密码</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || token.length !== 43}
        >
          {submitting ? "设置中…" : "设置密码"}
        </Button>
      </form>
    </Card>
  );
}
