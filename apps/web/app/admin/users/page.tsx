"use client";

import { useEffect, useState } from "react";
import AlertBanner from "@/components/admin/AlertBanner";
import { createAdminUser, deleteAdminUser, getAdminUsers, getMe } from "@/lib/admin/api";
import type { AdminUser, AuthUser } from "@/lib/admin/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [me, setMe] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    name: "",
    role: "staff" as "admin" | "staff",
    password: "",
  });

  const load = () => {
    setLoading(true);
    Promise.all([getAdminUsers(), getMe()])
      .then(([list, current]) => {
        setUsers(list);
        setMe(current);
      })
      .catch((err) =>
        setMessage({ type: "error", text: err instanceof Error ? err.message : "加载失败" }),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createAdminUser({
        email: form.email.trim(),
        name: form.name.trim(),
        role: form.role,
        password: form.password.trim() || undefined,
      });
      setCreatedPassword(result.initialPassword);
      setMessage({ type: "success", text: "用户已创建，初始密码见下方" });
      setForm({ email: "", name: "", role: "staff", password: "" });
      load();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "创建失败" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-warm-charcoal">用户管理</h1>
        <p className="text-sm text-muted-foreground">仅管理员可创建 staff / admin 账号</p>
      </div>

      {message && (
        <AlertBanner
          type={message.type}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      )}

      {createdPassword && (
        <AlertBanner
          type="success"
          message={`初始密码：${createdPassword}（已尝试发送至用户邮箱）`}
          onDismiss={() => setCreatedPassword(null)}
        />
      )}

      <form
        onSubmit={handleCreate}
        className="grid max-w-lg gap-4 rounded-xl border border-border bg-card p-4"
      >
        <h2 className="font-medium">新建用户</h2>
        <div>
          <Label htmlFor="email">邮箱</Label>
          <Input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="name">姓名</Label>
          <Input
            id="name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="role">角色</Label>
          <select
            id="role"
            className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "staff" })}
          >
            <option value="staff">staff（预约/订单）</option>
            <option value="admin">admin（全部权限）</option>
          </select>
        </div>
        <div>
          <Label htmlFor="password">初始密码（留空自动生成）</Label>
          <Input
            id="password"
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <Button type="submit">创建用户</Button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3">姓名</th>
                <th className="px-4 py-3">邮箱</th>
                <th className="px-4 py-3">角色</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{user.name}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{user.role}</td>
                  <td className="px-4 py-3">
                    {user.id !== me?.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (!confirm(`删除用户 ${user.email}？`)) return;
                          await deleteAdminUser(user.id);
                          load();
                        }}
                      >
                        删除
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
