"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAdminCategories,
  getAdminProjects,
  getAdminQueueSummary,
  getAdminSettings,
} from "@/lib/admin/api";
import type { AdminQueueSummary } from "@/lib/admin/types";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<{
    projects: number;
    categories: number;
    settingsReady: boolean;
  } | null>(null);
  const [queue, setQueue] = useState<AdminQueueSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getAdminProjects(), getAdminCategories(), getAdminSettings(), getAdminQueueSummary()])
      .then(([projects, categories, settings, summary]) => {
        setStats({
          projects: projects.total,
          categories: categories.length,
          settingsReady: Boolean(settings?.storeName),
        });
        setQueue(summary);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">看板</h1>
        <p className="text-sm text-muted-foreground">预约与内容管理概览</p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{stats?.projects ?? "—"}</CardTitle>
            <CardDescription>DIY 项目</CardDescription>
          </CardHeader>
          <Link href="/admin/projects" className="text-sm text-primary hover:underline">
            管理项目 →
          </Link>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{stats?.categories ?? "—"}</CardTitle>
            <CardDescription>项目分类</CardDescription>
          </CardHeader>
          <Link href="/admin/categories" className="text-sm text-primary hover:underline">
            管理分类 →
          </Link>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {stats?.settingsReady ? "已配置" : "—"}
            </CardTitle>
            <CardDescription>站点设置</CardDescription>
          </CardHeader>
          <Link href="/admin/settings" className="text-sm text-primary hover:underline">
            编辑设置 →
          </Link>
        </Card>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-serif text-xl font-semibold text-warm-charcoal">待处理队列</h2>
          <p className="text-sm text-muted-foreground">按当前登录员工的已读状态统计</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QueueCard count={queue?.unseen.total} label="未读请求" query="unread=true" />
          <QueueCard count={queue?.new} label="新请求" query="status=new" />
          <QueueCard count={queue?.contacted} label="已联系" query="status=contacted" />
          <QueueCard count={queue?.overdue} label="超时未处理" query="overdue=true" />
          <QueueCard count={queue?.confirmedToday} label="今日确认" query="confirmedToday=true" />
          <Card>
            <CardHeader>
              <CardTitle>{queue?.emailFailures ?? "—"}</CardTitle>
              <CardDescription>邮件发送失败</CardDescription>
            </CardHeader>
            <Link href="/admin/email-deliveries?status=failed" className="text-sm text-primary hover:underline">
              查看失败邮件 →
            </Link>
          </Card>
        </div>
      </section>
    </div>
  );
}

function QueueCard({ count, label, query }: { count: number | undefined; label: string; query: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{count ?? "—"}</CardTitle>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <div className="flex gap-3 text-sm">
        <Link href={`/admin/bookings?${query}`} className="text-primary hover:underline">预约 →</Link>
        <Link href={`/admin/orders?${query}`} className="text-primary hover:underline">产品 →</Link>
      </div>
    </Card>
  );
}
