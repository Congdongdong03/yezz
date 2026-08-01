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
  { href: "/admin", label: "今日运营", exact: true },
  { href: "/admin/bookings", label: "预约处理", badgeKey: "bookings" },
  { href: "/admin/schedule", label: "周排班" },
  { href: "/admin/orders", label: "订单", badgeKey: "orders" },
  { href: "/admin/time-slots", label: "旧档期" },
  { href: "/admin/email-deliveries", label: "邮件异常" },
  { href: "/admin/projects", label: "项目", adminOnly: true },
  { href: "/admin/catalogue", label: "公开项目展示", adminOnly: true },
  { href: "/admin/parties", label: "派对套餐", adminOnly: true },
  { href: "/admin/gallery", label: "画廊", adminOnly: true },
  { href: "/admin/categories", label: "分类", adminOnly: true },
  { href: "/admin/settings", label: "站点设置", adminOnly: true },
  { href: "/admin/users", label: "用户", adminOnly: true },
  { href: "/admin/account", label: "账户" },
];

const STAFF_BLOCKED_PREFIXES = [
  "/admin/projects",
  "/admin/catalogue",
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
  const isPublicAuth =
    pathname === "/admin/login" ||
    pathname === "/admin/forgot-password" ||
    pathname === "/admin/setup-password";
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [unread, setUnread] = useState<UnreadCounts>({ bookings: 0, orders: 0, total: 0 });

  useEffect(() => {
    clearLegacyAdminToken();
    if (isPublicAuth) {
      void Promise.resolve().then(() => setReady(true));
      return;
    }

    getMe()
      .then((u) => {
        setUser(u);
        setReady(true);
      })
      .catch(() => router.replace("/admin/login"));
  }, [isPublicAuth, router, pathname]);

  useEffect(() => {
    if (!ready || isPublicAuth || !user) return;
    if (user.role === "staff" && STAFF_BLOCKED_PREFIXES.some((p) => pathname.startsWith(p))) {
      router.replace("/admin/bookings");
    }
  }, [ready, isPublicAuth, user, pathname, router]);

  useEffect(() => {
    if (!ready || isPublicAuth) return;

    const refresh = () => {
      getUnreadCounts()
        .then(setUnread)
        .catch(() => {});
    };

    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [ready, isPublicAuth, pathname]);

  if (isPublicAuth) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        加载中…
      </div>
    );
  }

  const visibleNav = navItems.filter(
    (item) => user?.role !== "staff" || !item.adminOnly,
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F3F2] md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-[#DED9D7] bg-white md:w-52 md:border-r md:border-b-0">
        <div className="border-b border-[#DED9D7] px-4 py-4">
          <Link href="/admin" className="font-serif text-lg font-semibold text-[#302F2F]">
            YezYY 运营台
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {user?.role === "staff" ? "前台值班" : "运营与内容管理"}
          </p>
        </div>
        <nav className="flex flex-1 gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible md:p-3">
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
                  "flex shrink-0 items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 md:shrink",
                  active
                    ? "bg-[#302F2F] text-white"
                    : "text-[#302F2F] hover:bg-[#F5F3F2]",
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
        <div className="hidden border-t border-border p-3 md:block">
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
        <header className="flex h-12 items-center border-b border-[#DED9D7] bg-white px-4 sm:px-6">
          <p className="text-sm text-[#6E6968]">墨尔本时间 · 到店运营</p>
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
        <main className="flex-1 p-3 sm:p-5 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
