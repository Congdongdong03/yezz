import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AdminCatalogueEntry } from "@/lib/admin/types";

export default function CatalogueList({
  items,
}: {
  items: AdminCatalogueEntry[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-border bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-4 py-3">公开名称</th>
            <th className="px-4 py-3">分类</th>
            <th className="px-4 py-3">状态</th>
            <th className="px-4 py-3">价格来源</th>
            <th className="px-4 py-3">排序</th>
            <th className="px-4 py-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-border last:border-0"
            >
              <td className="px-4 py-3">
                <strong>{item.name.zh}</strong>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {item.name.en} · {item.slug}
                </span>
              </td>
              <td className="px-4 py-3">{item.category.name.zh}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    item.published
                      ? "rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800"
                      : "rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700"
                  }
                >
                  {item.published ? "已发布" : "已隐藏"}
                </span>
                {item.featured ? (
                  <span className="ml-2 rounded-full bg-pink-100 px-2 py-1 text-xs text-pink-800">
                    首页推荐
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3">{item.variants.length} 个项目</td>
              <td className="px-4 py-3">{item.sortOrder}</td>
              <td className="px-4 py-3 text-right">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/catalogue/${item.id}/edit`}>编辑</Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
