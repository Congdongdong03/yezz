"use client";

import Link from "next/link";
import { useState } from "react";
import AlertBanner from "@/components/admin/AlertBanner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/admin/api";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email.normalize("NFKC").trim().toLowerCase());
      setEmail("");
      setComplete(true);
    } catch {
      setError("暂时无法发送重置邮件，请稍后再试。");
      setSubmitting(false);
    }
  };

  if (complete) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>请检查邮箱</CardTitle>
          <CardDescription className="space-y-2">
            <span className="block">
              如果该邮箱属于后台账户，我们已经发送了密码重置链接。
            </span>
            <span className="block">链接将在 1 小时后失效，并且只能使用一次。</span>
          </CardDescription>
        </CardHeader>
        <Link
          href="/admin/login"
          className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          返回登录
        </Link>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>重置后台密码</CardTitle>
        <CardDescription>
          输入后台账户邮箱，我们会发送一个安全的一次性重置链接。
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
          <Label htmlFor="recovery-email">邮箱</Label>
          <Input
            id="recovery-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "发送中…" : "发送重置链接"}
        </Button>
        <Link
          href="/admin/login"
          className="block text-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          返回登录
        </Link>
      </form>
    </Card>
  );
}
