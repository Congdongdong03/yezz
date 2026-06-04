"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMe, getUnreadCounts, logout } from "@/lib/admin/api";
import type { AuthUser, UnreadCounts } from "@/lib/admin/types";
import { clearLegacyAdminToken } from "@/lib/admin/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  adminOnly?: boolean;
  badgeKey?: "bookings" | "orders";
};

const navItems: NavItem[] = [
  { href: "/admin", label: "看板", exact: true },
  { href: "/admin/bookings", label: "预约", badgeKey: "bookings" },
  { href: "/admin/orders", label: "订单", badgeKey: "orders" },
  { href: "/admin/time-slots", label: "档期" },
  { href: "/admin/projects", label: "项目", adminOnly: true },
  { href: "/admin/parties", label: "派对套餐", adminOnly: true },
  { href: "/admin/gallery", label: "画廊", adminOnly: true },
  { href: "/admin/categories", label: "分类", adminOnly: true },
  { href: "/admin/settings", label: "站点设置", adminOnly: true },
  { href: "/admin/users", label: "用户", adminOnly: true },
];

const STAFF_BLOCKED_PREFIXES = [
  "/admin/projects",
  "/admin/parties",
  "/admin/gallery",
  "/admin/categories",
  "/admin/settings",
  "/admin/users",
];

function formatBadge(count: number) {
  if (count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [unread, setUnread] = useState<UnreadCounts>({ bookings: 0, orders: 0, total: 0 });

  useEffect(() => {
    clearLegacyAdminToken();
    if (isLogin) {
      setReady(true);
      return;
    }

    getMe()
      .then((u) => {
        setUser(u);
        setReady(true);
      })
      .catch(() => router.replace("/admin/login"));
  }, [isLogin, router, pathname]);

  useEffect(() => {
    if (!ready || isLogin || !user) return;
    if (user.role === "staff" && STAFF_BLOCKED_PREFIXES.some((p) => pathname.startsWith(p))) {
      router.replace("/admin/bookings");
    }
  }, [ready, isLogin, user, pathname, router]);

  useEffect(() => {
    if (!ready || isLogin) return;

    const refresh = () => {
      getUnreadCounts()
        .then(setUnread)
        .catch(() => {});
    };

    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [ready, isLogin, pathname]);

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

  const visibleNav = navItems.filter((item) => user?.role === "admin" || !item.adminOnly);

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-4 py-5">
          <Link href="/admin" className="font-serif text-lg font-semibold text-warm-charcoal">
            YEZZ Admin
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {user?.role === "staff" ? "前台运营" : "内容管理"}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {visibleNav.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const badge =
              item.badgeKey === "bookings"
                ? formatBadge(unread.bookings)
                : item.badgeKey === "orders"
                  ? formatBadge(unread.orders)
                  : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-warm-charcoal hover:bg-muted",
                )}
              >
                <span>{item.label}</span>
                {badge && (
                  <span
                    className={cn(
                      "min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-xs font-medium",
                      active ? "bg-primary-foreground/20" : "bg-caramel text-white",
                    )}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={async () => {
              try {
                await logout();
              } catch {
                /* ignore */
              }
              router.push("/admin/login");
            }}
          >
            退出登录
          </Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-border bg-card px-6">
          <p className="text-sm text-muted-foreground">官网内容后台</p>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/zh"
              className="text-sm text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              中文站 ↗
            </Link>
            <Link
              href="/en"
              className="text-sm text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              English ↗
            </Link>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
