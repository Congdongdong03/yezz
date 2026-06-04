"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAdminToken, isAdminLoggedIn } from "@/lib/admin/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/admin", label: "看板", exact: true },
  { href: "/admin/projects", label: "项目" },
  { href: "/admin/parties", label: "派对套餐" },
  { href: "/admin/gallery", label: "画廊" },
  { href: "/admin/bookings", label: "预约" },
  { href: "/admin/orders", label: "订单" },
  { href: "/admin/categories", label: "分类" },
  { href: "/admin/settings", label: "站点设置" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLogin) {
      setReady(true);
      return;
    }
    if (!isAdminLoggedIn()) {
      router.replace("/admin/login");
      return;
    }
    setReady(true);
  }, [isLogin, router, pathname]);

  if (isLogin) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        加载中…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-4 py-5">
          <Link href="/admin" className="font-serif text-lg font-semibold text-warm-charcoal">
            YEZZ Admin
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">内容管理</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-warm-charcoal hover:bg-muted",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              clearAdminToken();
              router.push("/admin/login");
            }}
          >
            退出登录
          </Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-border bg-card px-6">
          <p className="text-sm text-muted-foreground">
            官网内容后台
          </p>
          <div className="ml-auto">
            <Link
              href="/zh"
              className="text-sm text-primary hover:underline"
              target="_blank"
            >
              查看官网 ↗
            </Link>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
