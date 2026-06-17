# YEZZ 前端数据层改造方案

## 执行摘要

将 YEZZ 前端从分散的 `fetch()` + `useState` + `useEffect` 模式，迁移到 **TanStack Query（数据获取）+ Zustand（全局状态）** 的现代化架构。解决当前 Admin 页面数据管理重复、无客户端缓存、表单提交后数据不同步等痛点。

**预期收益：**
- Admin 页面代码量减少 30-40%（删除重复的 loading/error/state 管理）
- 页面间数据自动同步（Admin 编辑项目后列表自动刷新）
- 表单提交支持乐观更新和自动重试
- 统一的错误处理和 Loading 状态

**预估工期：** 2-3 天（可分阶段实施）

### 优先级速查表

| 优先级 | 标记 | 内容 | 理由 |
|--------|------|------|------|
| **一档** | 🔴 | Admin 页面 `useEffect` → `useQuery` 改造 | 不改会拖慢后续开发，样板代码太多 |
| **二档** | 🟡 | 统一 API Client + TanStack Query 基础设施 | 提升开发体验，方便后续维护 |
| **三档** | 🟢 | Cart Zustand 迁移 + Server Actions 统一化 | 锦上添花，业务量大之前不用动 |

---

## 1. 现状分析

### 1.1 当前架构地图

| 模块 | 当前模式 | 文件位置 |
|------|---------|---------|
| **Public 页面数据** | Server Component → Loader 函数 → `apiFetch()` | `lib/site/data.ts`, `lib/projects/data.ts` |
| **Admin 页面数据** | Client Component → `useEffect` → `adminFetch()` → `useState` | `lib/admin/api.ts`, 各 `page.tsx` |
| **表单提交** | Server Action → 直接 `fetch()` | `lib/actions/booking.ts`, `lib/actions/cart.ts` |
| **购物车状态** | React Context + `localStorage` + 服务端同步 | `lib/cart/context.tsx` |

### 1.2 具体问题

#### A. Admin 页面：重复样板代码
每个 Admin 页面都有相同的模式：

```tsx
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  getAdminBookings()
    .then(setData)
    .catch(setError)
    .finally(() => setLoading(false));
}, []);

// 删除后手动刷新
const handleDelete = async (id) => {
  await deleteBooking(id);
  // 必须手动重新请求
  const updated = await getAdminBookings();
  setData(updated);
};
```

**问题：** 12 个 Admin 页面 × 重复的 loading/error/refresh 逻辑 = 大量样板代码。

#### B. 无客户端缓存
用户从 Admin 列表页进入详情页，再返回列表页 → 重新请求全部数据。没有内存级缓存。

#### C. 数据不同步
Admin 在详情页把预约状态改为"已联系"，返回列表页 → 列表显示的还是旧状态，必须手动刷新。

#### D. 两套独立的 HTTP 调用逻辑
- Public API: `lib/api/client.ts` (`apiFetch`)
- Admin API: `lib/admin/api.ts` (`adminFetch`)
- Server Actions: `lib/actions/*.ts` (直接 `fetch()`)
- Cart: `lib/cart/session.ts` (直接 `fetch()`)

四套不同的错误处理、超时配置、base URL 拼接逻辑。

#### E. 表单提交无反馈优化
提交预约表单后：
- 没有乐观更新（用户等待期间页面无变化）
- 失败后需要手动重填
- 成功后相关数据不会自动刷新（比如 Admin 列表不会自动出现新预约）

---

## 2. 目标架构

### 2.1 技术选型

| 职责 | 选型 | 理由 |
|------|------|------|
| **服务端数据缓存** | TanStack Query (React Query) v5 | 业界标准，缓存、重试、去重、后台刷新、窗口聚焦重取 |
| **客户端全局状态** | Zustand | 轻量、TypeScript 友好、无需 Provider |
| **服务端 Action** | 保留 Next.js Server Actions | 表单提交天然优势，与 TanStack Query mutations 结合 |

### 2.2 目标架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Public Pages │  │ Admin Pages  │  │ Cart / Drawer    │  │
│  │ (Server Comp)│  │ (Client Comp)│  │ (Client Comp)    │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼─────────────────┼───────────────────┼────────────┘
          │                 │                   │
          ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Loaders      │  │ useQuery     │  │ Zustand Store    │  │
│  │ (Server-side)│  │ (Client-side)│  │ (cart, toast)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘  │
└─────────┼─────────────────┼──────────────────────────────────┘
          │                 │
          ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Client Layer                         │
│              Unified `fetch` wrapper (`apiClient`)           │
│     - Public API, Admin API, Server Actions 共用底层         │
│     - 统一的错误码解析、超时、重试、请求/响应拦截           │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 各模块改造策略

| 模块 | 当前 | 目标 | 改造方式 |
|------|------|------|---------|
| **Public Loaders** | `lib/site/data.ts` 中的 `loadHomePageData()` 等 | **保留**，作为 TanStack Query 的 `queryFn` | 轻微重构，提取为独立函数 |
| **Admin 数据获取** | `useEffect` + `useState` | `useQuery` / `useMutation` | 全面替换 |
| **Admin 表单提交** | `adminFetch()` + 手动刷新 | `useMutation` + 自动 invalidate | 全面替换 |
| **Server Actions** | 直接 `fetch()` | 封装为 `apiClient.mutate()`，Server Action 作为轻量 wrapper | 重构 |
| **Cart Context** | React Context + `useState` | **Zustand Store** | 替换 |

---

## 3. 具体设计

### 🟡 二档：统一 API Client (`lib/api/client-v2.ts`)

合并现有的 `lib/api/client.ts` + `lib/admin/api.ts` + `lib/actions/*.ts` 中的 fetch 逻辑，提供一个统一的客户端：

```typescript
// lib/api/client-v2.ts
interface ApiClientOptions {
  baseUrl?: string;
  credentials?: RequestCredentials;
  headers?: Record<string, string>;
}

class ApiClient {
  async get<T>(path: string, options?: RequestInit): Promise<T>;
  async post<T>(path: string, body: unknown, options?: RequestInit): Promise<T>;
  async patch<T>(path: string, body: unknown, options?: RequestInit): Promise<T>;
  async delete<T>(path: string, options?: RequestInit): Promise<T>;
}

// 预配置实例
export const publicClient = new ApiClient({ baseUrl: getApiBaseUrl() });
export const adminClient = new ApiClient({
  baseUrl: getApiBaseUrl(),
  credentials: "include",
});
```

**设计要点：**
- 自动处理 `{ success, data }` 响应信封
- 统一错误类 `ApiError`（含 `code`, `message`, `status`）
- 自动在 Admin 请求中携带 cookie
- Server Action 中也可以直接使用（因为它是普通 async 函数）

### 🟡 二档：TanStack Query 配置 (`lib/api/query-client.ts`)

```typescript
// lib/api/query-client.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,     // 5 分钟内数据视为新鲜
      gcTime: 1000 * 60 * 30,       // 30 分钟缓存
      retry: 1,                      // 失败重试 1 次
      refetchOnWindowFocus: false,   // Admin 后台不切窗口刷新
    },
    mutations: {
      retry: 0,
    },
  },
});
```

### 🟡 二档：Query Keys 设计

统一的 key 命名规范，确保 invalidate 能精准触发：

```typescript
// lib/api/query-keys.ts
export const queryKeys = {
  categories: ["categories"] as const,
  projects: (filters?: object) => ["projects", filters] as const,
  project: (slug: string) => ["project", slug] as const,
  bookings: (filters?: object) => ["admin", "bookings", filters] as const,
  booking: (id: string) => ["admin", "booking", id] as const,
  orders: (filters?: object) => ["admin", "orders", filters] as const,
  order: (id: string) => ["admin", "order", id] as const,
  gallery: ["gallery"] as const,
  settings: ["settings"] as const,
  timeSlots: (date?: string) => ["timeSlots", date] as const,
  cart: ["cart"] as const,
};
```

### 🔴 一档：Admin 页面改造示例

以 `/admin/bookings` 为例：

**改造前（当前）：**
```tsx
"use client";
export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  // ... useEffect fetch
  // ... manual refresh after update
}
```

**改造后：**
```tsx
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { getAdminBookings, updateBookingStatus } from "@/lib/admin/api";

export default function BookingsPage() {
  const { data: bookings, isLoading, error } = useQuery({
    queryKey: queryKeys.bookings(),
    queryFn: getAdminBookings,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateBookingStatus(id, status),
    onSuccess: () => {
      // 自动刷新列表 + 详情页
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings() });
    },
  });

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorFallback error={error} />;

  return <BookingsTable data={bookings} onUpdate={updateMutation.mutate} />;
}
```

**收益：**
- 删除了 `useState`、`useEffect`、手动刷新逻辑
- 更新状态后列表自动刷新
- Loading 和 Error 状态标准化

### 🟢 三档：Server Actions 改造

保留 Server Actions 作为表单入口，但内部使用统一 client：

```typescript
// lib/actions/booking.ts (改造后)
"use server";
import { publicClient } from "@/lib/api/client-v2";

export async function submitBooking(formData: FormData) {
  const validated = bookingSchema.parse(Object.fromEntries(formData));

  // 使用统一 client，享受统一的超时、重试、错误处理
  return publicClient.post("/api/v1/bookings", validated);
}
```

表单组件配合 `useMutation`：

```tsx
// components/book/BookingForm.tsx
const mutation = useMutation({
  mutationFn: submitBooking,
  onSuccess: () => {
    // 预约成功后，刷新相关数据
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings() });
    toast.success("预约提交成功！");
    router.push("/zh/book/success");
  },
  onError: (error) => {
    toast.error(error.message);
  },
});
```

### 🟢 三档：Cart 状态迁移（Zustand）

将 Cart Context 迁移为 Zustand Store，保留 `localStorage` 持久化和服务端同步逻辑：

```typescript
// lib/cart/store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  isLoading: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  setIsOpen: (open: boolean) => void;
  syncToServer: () => Promise<void>;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      isLoading: false,
      addItem: (item) => {
        set((state) => ({ items: [...state.items, item] }));
        get().syncToServer();
      },
      // ...
    }),
    { name: "yezz-cart" }
  )
);
```

**为什么迁移到 Zustand：**
- Context 的 `useState` 会导致不必要的重渲染（任何子组件更新都会触发所有消费者重渲染）
- Zustand 支持选择器订阅，只有真正依赖的数据变化才重渲染
- `persist` 中间件内置 localStorage 支持，无需手写
- 更容易与 TanStack Query 结合（`syncToServer` 可以用 `useMutation`）

---

## 4. 实施计划

### 🟡 二档：Phase 1 — 基础设施（0.5 天）

1. **安装依赖**
   ```bash
   pnpm --filter @yezz/web add @tanstack/react-query zustand @tanstack/react-query-devtools
   ```

2. **创建统一 API Client**
   - `lib/api/client-v2.ts` — 合并 public + admin fetch 逻辑
   - `lib/api/query-client.ts` — QueryClient 配置
   - `lib/api/query-keys.ts` — 统一 key 定义

3. **配置 Provider**
   - 在 `app/layout.tsx` 或 `app/providers.tsx` 中包裹 `QueryClientProvider`
   - 开发环境启用 React Query Devtools

4. **验证**
   - `pnpm typecheck` 通过
   - 现有页面功能不受影响

### 🔴 一档：Phase 2 — Admin 页面迁移（1.5 天）

按优先级逐个改造 Admin 页面：

| 顺序 | 页面 | 复杂度 | 理由 |
|------|------|--------|------|
| 1 | `/admin/bookings` | 中 | 有列表 + 状态更新，最能体现收益 |
| 2 | `/admin/orders` | 中 | 与 bookings 模式相同 |
| 3 | `/admin/projects` | 中 | 有 CRUD + 图片上传 |
| 4 | `/admin/categories` | 低 | 纯列表 |
| 5 | `/admin/gallery` | 中 | 有图片管理 |
| 6 | `/admin/parties` | 中 | 有 CRUD |
| 7 | `/admin/settings` | 低 | 单条数据 |
| 8 | `/admin/users` | 低 | 纯列表 |
| 9 | `/admin/time-slots` | 中 | 有日历交互 |

**每个页面的改造步骤：**
1. 用 `useQuery` 替换 `useEffect` + `useState` 的数据获取
2. 用 `useMutation` 替换表单提交 / 状态更新
3. 添加 `queryClient.invalidateQueries` 实现自动刷新
4. 删除废弃的手动刷新代码
5. 本地验证功能正常

### 🟢 三档：Phase 3 — Cart 迁移（0.5 天）

1. 创建 `lib/cart/store.ts`（Zustand）
2. 将 `CartProvider` 替换为 `useCartStore`
3. 用 `useMutation` 替换 `saveCartToServer` / `loadCartFromServer`
4. 验证 localStorage 持久化和服务端同步正常

### 🟢 三档：Phase 4 — 清理与优化（0.5 天）

1. **Server Actions 统一化**
   - 将 `lib/actions/booking.ts`、`lib/actions/cart.ts` 中的 `fetch()` 替换为统一 client
2. **删除旧代码**
   - 确认 `lib/api/client.ts` 和 `lib/admin/api.ts` 无引用后删除（或保留为兼容层）
3. **全局验证**
   - `pnpm typecheck`
   - `pnpm --filter @yezz/web build`
   - `pnpm test:api`
   - E2E 回归测试

---

## 5. 文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `lib/api/client-v2.ts` | 统一 API Client |
| `lib/api/query-client.ts` | TanStack Query Client 配置 |
| `lib/api/query-keys.ts` | Query Key 定义 |
| `lib/cart/store.ts` | Zustand Cart Store |
| `components/providers/QueryProvider.tsx` | QueryClientProvider 包装 |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `app/layout.tsx` | 添加 QueryProvider 和 Cart Store Provider |
| `lib/api/client.ts` | 标记为废弃，引导到新 client |
| `lib/admin/api.ts` | 重构为基于 client-v2 的函数 |
| `lib/actions/booking.ts` | 使用 client-v2 |
| `lib/actions/cart.ts` | 使用 client-v2 |
| `lib/cart/context.tsx` | 重构为基于 store 的兼容层 |
| `app/admin/bookings/page.tsx` | 改用 useQuery/useMutation |
| `app/admin/orders/page.tsx` | 改用 useQuery/useMutation |
| `app/admin/projects/page.tsx` | 改用 useQuery/useMutation |
| ...（其余 Admin 页面） | 同上模式 |
| `components/cart/CartDrawer.tsx` | 改用 useCartStore |
| `components/cart/CartIcon.tsx` | 改用 useCartStore |

### 删除文件（Phase 4）

| 文件 | 说明 |
|------|------|
| `lib/api/client.ts` | 被 client-v2 替代 |
| `lib/cart/context.tsx` | 被 store 替代（或保留薄兼容层） |
| `lib/cart/storage.ts` | 被 zustand persist 替代 |

---

## 6. 风险与回滚策略

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| TanStack Query 缓存导致数据不新鲜 | 中 | 中 | 合理配置 `staleTime`，关键操作后主动 `invalidateQueries` |
| Zustand 持久化与现有 localStorage 格式冲突 | 低 | 中 | 迁移时检查旧格式，做数据迁移逻辑 |
| Admin 页面改造引入回归 bug | 中 | 高 | 每个页面改造后立刻运行对应 E2E 测试 |
| Server Actions 与统一 client 兼容性问题 | 低 | 高 | Phase 1 先在非关键 Server Action 中验证 |

**回滚策略：**
- 每个 Phase 单独提交（`phase-1: infra`, `phase-2: admin-bookings`, ...）
- 如果发现问题，可单独 revert 某个页面的 commit
- 旧 `lib/api/client.ts` 在 Phase 4 前保留，可随时回切

---

## 7. 验收标准

- [ ] `pnpm typecheck` 零错误
- [ ] `pnpm --filter @yezz/web build` 成功
- [ ] `pnpm test:api` 全部通过
- [ ] E2E 测试全部通过（`cart.spec.ts`, `admin-booking.spec.ts`, `booking.spec.ts`）
- [ ] Admin 列表页更新状态后，返回列表自动显示最新数据（无需手动刷新）
- [ ] Cart 操作（添加、删除、清空）后 localStorage 和服务端同步正常
- [ ] 网络断开重连后，Admin 页面自动刷新数据

---

## 8. 附录：渐进式实施建议

如果工期紧张，可以采用**最小可行改造**策略：

1. **只做 Phase 1 + Phase 2 的前 3 个页面**（bookings, orders, projects）
2. 其余 Admin 页面保持现状，但新功能必须用新架构写
3. 旧页面在后续迭代中逐步迁移

这样 1 天就能体验到核心收益，同时不影响现有功能。
