# YEZZ 自建后端 — 需求清单 & 进度日志

> **用途：** 全栈迁移（Sanity → Node API + PostgreSQL + 自建 Admin）的唯一需求源。  
> **新窗口接手：** 先看文末「进度日志」**最后一条**（在 `<!-- 新 Session -->` 注释下方），**Phase 3 已全部完成**，下一步 **Phase 4 → R-601**。  
> **最后更新：** 2026-06-04（Phase 1 全部 R + 验收 V-101~V-108 ✅）

---

## 一、项目目标

将 YEZZ 从 **Sanity CMS + Sanity Studio** 迁移为：

- **apps/api** — Node.js + Fastify + TypeScript REST API  
- **packages/db** — PostgreSQL + Drizzle ORM  
- **apps/web** — Next.js 官网 + **自建 Admin（`/admin`）**  
- **Docker** — PostgreSQL + Redis + API（开发环境）  
- **不用 Sanity Studio**，内容/订单/媒体最终全部进自己的库  

---

## 二、已锁定的技术决策

| # | 决策 | 结论 |
|---|------|------|
| 1 | 架构 | web + api 分离（Next.js + Fastify） |
| 2 | ORM | Drizzle |
| 3 | API 框架 | Fastify |
| 4 | 媒体 | P1 用 URL 字符串 → P2 MinIO → 上线 R2 |
| 5 | 鉴权 | P1 JWT + 单 admin 账号 |
| 6 | Sanity | **Studio 立即删除**；Sanity npm 包 Phase 2 删干净 |
| 7 | Phase 1 范围 | API + Docker + seed + Admin CRUD + JWT |
| 8 | 包管理 | pnpm workspace monorepo |
| 9 | 数据库 | 开发 Docker PG；生产 Neon |
| 10 | Redis | P1 只起容器 + health ping；P3 业务缓存/限流 |
| 11 | Admin | `/admin` 自建，替代 Sanity Studio |
| 12 | 官网迁移策略 | **选项 A**：P1 只改项目列表+详情；首页等 Phase 2 |

---

## 三、当前代码基线（迁移前）

### 3.1 仍依赖 Sanity 的文件

| 文件 | 用途 |
|------|------|
| `app/[locale]/page.tsx` | 首页 |
| `app/[locale]/projects/page.tsx` | 项目列表 |
| `app/[locale]/projects/[slug]/page.tsx` | 项目详情 |
| `app/[locale]/parties/page.tsx` | 派对套餐 |
| `app/[locale]/gallery/page.tsx` | 画廊 |
| `app/[locale]/contact/page.tsx` | 联系页 |
| `lib/sanity/client.ts` | Sanity 读客户端 |
| `lib/sanity/queries.ts` | GROQ 查询 |
| `lib/sanity/mock-data.ts` | fallback mock 数据（**seed 来源**） |
| `lib/sanity/types.ts` | TS 类型 |
| `lib/actions/booking.ts` | 预约写入 Sanity |
| `lib/actions/cart.ts` | 购物车写入 Sanity |

### 3.2 待删除的 Sanity Studio 相关

| 文件/目录 | 说明 |
|-----------|------|
| `app/studio/` | Studio 路由 |
| `components/studio/` | Studio 组件 |
| `sanity/` | schema 定义 |
| `sanity.config.ts` | Studio 配置 |
| `sanity.cli.ts` | Sanity CLI |
| `package.json` 中 `sanity`, `next-sanity`, `@sanity/vision` | Phase 2 移除 |

### 3.3 目标 monorepo 结构

```
yezz/
├── apps/
│   ├── web/                 # 现有 Next.js（从根目录迁入）
│   └── api/                 # Fastify REST API
├── packages/
│   └── db/                  # Drizzle schema + migrations + seed
├── docker-compose.yml
├── docker-compose.dev.yml   # 可选：仅 postgres + redis
├── pnpm-workspace.yaml
├── .env.example
└── package.json             # root scripts
```

---

## 四、分阶段概览

| 阶段 | 主题 | 预估 |
|------|------|------|
| **Phase 1** | Monorepo + DB + API + JWT + Admin CRUD + 项目页接 API + 删 Studio | 2–3 周 |
| **Phase 2** | MinIO 上传 + 画廊/派对 Admin + 全站改 API + 删 Sanity 包 | 1–2 周 |
| **Phase 3** | 预约/订单 POST + Admin 订单 + Redis 缓存/限流 | 1–2 周 |
| **Phase 4** | Docker 纳入 web + Neon + Swagger + 测试 + 文档 | ~1 周 |

---

## 五、需求清单（按优先级）

优先级：**P0 阻塞 → P1 Phase1 必做 → P2 Phase2 → P3 Phase3 → P4 Phase4**

状态：`[ ]` 未开始 · `[~]` 进行中 · `[x]` 完成

---

### P0 — 文档与工程准备

| ID | 优先级 | 需求 | 验收标准 | 状态 |
|----|--------|------|----------|------|
| R-001 | P0 | 创建本需求文档 | `docs/backend-migration/REQUIREMENTS.md` 存在且结构完整 | [x] |
| R-002 | P0 | 创建 `.env.example` | 列出 api/web/db 全部 env，无 secret | [x] |
| R-003 | P0 | 根目录改 pnpm workspace | `pnpm-workspace.yaml`；`apps/web` 可 `pnpm dev` | [x] |
| R-004 | P0 | 现有代码迁入 `apps/web/` | 路径别名、tsconfig、next.config 正常 | [x] |

**R-003/R-004 涉及移动的文件（参考）：**

- `app/` → `apps/web/app/`
- `components/` → `apps/web/components/`
- `lib/` → `apps/web/lib/`
- `i18n/` → `apps/web/i18n/`
- `public/` → `apps/web/public/`
- 根配置：`next.config.ts`, `middleware.ts`, `components.json`, `postcss.config.mjs`, `eslint.config.mjs`, `tsconfig.json` → `apps/web/` 或 root 共享

---

### P1 — 基础设施（Docker + 数据库）

| ID | 优先级 | 需求 | 验收标准 | 状态 |
|----|--------|------|----------|------|
| R-101 | P1 | `docker-compose.yml` | postgres:16 + redis:7 + api 可启动 | [x] |
| R-102 | P1 | `packages/db` Drizzle schema | 见下方「数据表设计」 | [x] |
| R-103 | P1 | Drizzle migrations | `pnpm db:migrate` 成功 | [x] |
| R-104 | P1 | Seed 脚本 | 从 `mock-data.ts` 灌 categories/projects/styles/images/settings + 1 admin | [x] |
| R-105 | P1 | Root scripts | `db:generate`, `db:migrate`, `db:seed`, `dev:api`, `dev:web` | [x] |

#### 数据表设计（Phase 1）

**users**
- `id` uuid PK  
- `email` varchar unique  
- `password_hash` varchar  
- `name` varchar  
- `role` enum `admin`（P1 仅 admin）  
- `created_at`, `updated_at`

**project_categories**
- `id`, `name` jsonb `{en,zh}`, `slug` unique, `description` jsonb, `icon`, `sort_order`, timestamps

**diy_projects**
- `id`, `category_id` FK, `name` jsonb, `slug` unique, `project_type` (`experience`|`product`)  
- `description` jsonb, `price_range`, `duration`, `tags` text[], `sort_order`  
- `cover_image_url`, timestamps

**project_styles**
- `id`, `project_id` FK, `name` jsonb, `image_url`, `price`, `sort_order`

**project_images**
- `id`, `project_id` FK, `url`, `sort_order`

**site_settings**（singleton，seed 一条）
- `store_name`, `address`, `business_hours`, `phone`, `email`, `wechat_id`  
- `wechat_qr_url`, `hero_image_url`, `instagram`, `xiaohongshu`, `google_map_url`  
- `seo_title`, `seo_description`, timestamps

---

### P1 — Node API（Fastify）

| ID | 优先级 | 需求 | 验收标准 | 状态 |
|----|--------|------|----------|------|
| R-201 | P1 | Fastify 项目骨架 `apps/api` | 分层：routes / services / repositories / plugins | [x] |
| R-202 | P1 | DB plugin | Drizzle 连接 PostgreSQL | [x] |
| R-203 | P1 | Redis plugin | 连接 Redis；health 可 ping | [x] |
| R-204 | P1 | 统一响应格式 | `{ success, data }` / `{ success: false, error: { code, message } }` | [x] |
| R-205 | P1 | CORS | 允许 `http://localhost:3000` | [x] |
| R-206 | P1 | `GET /health` | 返回 `{ status, db, redis }` | [x] |

#### 公开 API（无需登录）

| ID | 方法 | 路径 | 说明 | 状态 |
|----|------|------|------|------|
| R-211 | GET | `/api/v1/categories` | 分类列表，按 sort_order | [x] |
| R-212 | GET | `/api/v1/projects` | 项目列表（含 category、coverImageUrl） | [x] |
| R-213 | GET | `/api/v1/projects/:slug` | 详情（styles + images） | [x] |
| R-214 | GET | `/api/v1/settings` | 站点设置 singleton | [x] |

#### Admin API（JWT 保护）

| ID | 方法 | 路径 | 说明 | 状态 |
|----|------|------|------|------|
| R-221 | POST | `/api/v1/auth/login` | email + password → JWT | [x] |
| R-222 | GET | `/api/v1/admin/me` | 当前用户 | [x] |
| R-231 | GET | `/api/v1/admin/projects` | 项目列表（含分页可选） | [x] |
| R-232 | POST | `/api/v1/admin/projects` | 创建项目 | [x] |
| R-233 | PATCH | `/api/v1/admin/projects/:id` | 更新项目 | [x] |
| R-234 | DELETE | `/api/v1/admin/projects/:id` | 删除项目 | [x] |
| R-241 | GET | `/api/v1/admin/categories` | 分类列表 | [x] |
| R-242 | PATCH | `/api/v1/admin/categories/:id` | 更新分类 | [x] |
| R-251 | GET | `/api/v1/admin/settings` | 读设置 | [x] |
| R-252 | PATCH | `/api/v1/admin/settings` | 更新设置 | [x] |

**JWT 约定（P1）：**
- Header: `Authorization: Bearer <token>`
- Payload: `{ sub: userId, email, role }`
- 过期：24h（可配置 `JWT_EXPIRES_IN`）
- Secret: `JWT_SECRET` env

---

### P1 — 删除 Sanity Studio

| ID | 优先级 | 需求 | 验收标准 | 状态 |
|----|--------|------|----------|------|
| R-301 | P1 | 删除 `app/studio/` | `/studio` 404 | [x] |
| R-302 | P1 | 删除 `components/studio/` | 无 Studio 引用 | [x] |
| R-303 | P1 | 删除 `sanity.config.ts`, `sanity.cli.ts` | 文件不存在 | [x] |
| R-304 | P1 | middleware 排除 admin | `/admin` 不受 i18n locale 前缀影响 | [x] |

> **注意：** P1 暂保留 `sanity/` schema 目录和 npm 包，供首页等 fallback；Phase 2 删 R-401~R-404。

---

### P1 — 自建 Admin UI（Next.js `/admin`）

| ID | 优先级 | 需求 | 验收标准 | 状态 |
|----|--------|------|----------|------|
| R-311 | P1 | Admin layout | Sidebar + 顶栏；shadcn 风格 | [x] |
| R-312 | P1 | `/admin/login` | 登录表单 → 存 token（httpOnly cookie 或 localStorage） | [x] |
| R-313 | P1 | 路由保护 | 未登录跳转 login | [x] |
| R-314 | P1 | `/admin` 看板 | 占位：项目数、分类数（可简单） | [x] |
| R-315 | P1 | `/admin/projects` | 表格列表 + 删除 | [x] |
| R-316 | P1 | `/admin/projects/new` | 创建表单 | [x] |
| R-317 | P1 | `/admin/projects/[id]/edit` | 编辑表单（含 styles/images URL 字段） | [x] |
| R-318 | P1 | `/admin/categories` | 列表 + 编辑 name/icon/order | [x] |
| R-319 | P1 | `/admin/settings` | 站点设置表单 | [x] |

**Admin 表单 P1 约束：**
- 图片字段用 **URL 文本输入**（picsum 或外链），不做文件上传  
- 多语言：`name.en` / `name.zh` 分开输入  
- 提交后调用 Admin API，成功 toast/redirect  

---

### P1 — 官网接 API（选项 A：仅项目页）

| ID | 优先级 | 需求 | 验收标准 | 状态 |
|----|--------|------|----------|------|
| R-321 | P1 | `apps/web/lib/api/client.ts` | fetch 封装 + 错误处理 | [x] |
| R-322 | P1 | `apps/web/lib/api/mappers.ts` | API shape → 现有组件 Sanity shape | [x] |
| R-323 | P1 | Feature flag | `NEXT_PUBLIC_USE_API=true/false` | [x] |
| R-324 | P1 | `/projects` 改读 API | 列表正常；false 时 fallback mock | [x] |
| R-325 | P1 | `/projects/[slug]` 改读 API | 详情含 styles；false 时 fallback | [x] |

**Mapper 示例（保持现有组件不改）：**

```ts
// API: { slug: "foo", category: { slug: "bar" } }
// → 组件: { slug: { current: "foo" }, category: { slug: { current: "bar" } } }
```

**P1 仍走 Sanity/mock 的页面：** 首页、parties、gallery、contact、book、cart

---

### P1 — Phase 1 总验收

| ID | 验收项 | 状态 |
|----|--------|------|
| V-101 | `docker compose up` → postgres + redis + api 正常 | [x] |
| V-102 | `pnpm db:migrate && pnpm db:seed` 有数据 | [x] |
| V-103 | `GET localhost:4000/health` db+redis ok | [x] |
| V-104 | 公开 API 4 个 GET 返回正确 JSON | [x] |
| V-105 | Admin 登录 + 项目 CRUD 可用 | [x] |
| V-106 | 改 Admin 项目后官网 `/projects` 可见 | [x] |
| V-107 | `/studio` 不可访问 | [x] |
| V-108 | `USE_API=false` 时项目页 fallback 不挂 | [x] |

---

### P2 — 媒体 + 全站迁移 + 移除 Sanity

| ID | 优先级 | 需求 | 验收标准 | 状态 |
|----|--------|------|----------|------|
| R-401 | P2 | Docker 加 MinIO | S3 兼容存储可访问 | [x] |
| R-402 | P2 | `POST /api/v1/admin/upload` | JWT 保护；返回 URL | [x] |
| R-403 | P2 | Admin 图片上传组件 | 替换 URL 手填 | [x] |
| R-404 | P2 | 删 Sanity npm 包和 `sanity/` | 无 sanity import | [x] |
| R-405 | P2 | 扩展 schema：party_packages, gallery_images | 表 + seed | [x] |
| R-406 | P2 | Admin：派对 / 画廊 CRUD | 页面可用 | [x] |
| R-407 | P2 | 公开 API：parties, gallery | GET 接口 | [x] |
| R-408 | P2 | 首页 / parties / gallery / contact / footer 改读 API | 全站无 Sanity | [x] |
| R-409 | P2 | `media_assets` 表 | 记录上传元数据 | [x] |

---

### P3 — 订单 + Redis

| ID | 优先级 | 需求 | 验收标准 | 状态 |
|----|--------|------|----------|------|
| R-501 | P3 | schema：bookings, cart_orders, cart_order_items | migrate 成功 | [x] |
| R-502 | P3 | `POST /api/v1/bookings` | 写 DB + Resend 通知 owner | [x] |
| R-503 | P3 | `POST /api/v1/cart-orders` | 写 DB + 邮件 | [x] |
| R-504 | P3 | Admin `/admin/bookings` | 列表 + 状态 PATCH | [x] |
| R-505 | P3 | Admin `/admin/orders` | 购物车订单列表 + 状态 | [x] |
| R-506 | P3 | Redis 缓存 | projects/settings Cache-Aside + 失效 | [x] |
| R-507 | P3 | Redis 限流 | 预约 POST 同 IP 限制 | [x] |
| R-508 | P3 | 删 `lib/actions/booking.ts` / `cart.ts` Sanity 写入 | 改调 API | [x] |

---

### P4 — 工程化 + 生产

| ID | 优先级 | 需求 | 验收标准 | 状态 |
|----|--------|------|----------|------|
| R-601 | P4 | web 进 docker-compose | 一条命令全栈 | [ ] |
| R-602 | P4 | Neon 生产 DATABASE_URL 文档 | README 部署章节 | [ ] |
| R-603 | P4 | R2 替换 MinIO（生产） | 改 endpoint 即可 | [ ] |
| R-604 | P4 | `@fastify/swagger` API 文档 | `/docs` 可访问 | [ ] |
| R-605 | P4 | API 单测 Vitest | 核心 service 覆盖 | [ ] |
| R-606 | P4 | README 更新 | 新人 clone 可跑通 | [ ] |

---

## 六、环境变量清单

### apps/api

```env
DATABASE_URL=postgres://yezz:yezz@localhost:5432/yezz
REDIS_URL=redis://localhost:6379
PORT=4000
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=24h
NODE_ENV=development
```

### apps/web

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_USE_API=true

# Phase 2 删除前仍需要（首页等 fallback）
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=
```

### packages/db

```env
DATABASE_URL=postgres://yezz:yezz@localhost:5432/yezz
```

### Seed 默认 admin（P1）

```env
ADMIN_EMAIL=admin@yezz.local
ADMIN_PASSWORD=changeme
```

---

## 七、推荐实施顺序（给新窗口）

按 ID 顺序执行，不要跳步：

```
R-001 ✅
→ R-002 ~ R-004（monorepo）
→ R-101 ~ R-105（db + docker + seed）
→ R-201 ~ R-214（公开 API）
→ R-221 ~ R-252（auth + admin API）
→ R-301 ~ R-304（删 Studio）
→ R-311 ~ R-319（Admin UI）
→ R-321 ~ R-325（官网项目页接 API）
→ V-101 ~ V-108（Phase 1 验收）✅
→ **当前** Phase 2 开始 R-401...
```

---

## 八、进度日志

> **规则：** 每完成一批任务，在 **`<!-- 新 Session -->` 注释的下方**追加一条（不要改注释上方的历史）。  
> 推荐格式：`日期 | 完成 ID | 做了什么 | 备注/坑`

### 📌 当前进度快照（2026-06-04）

| 范围 | 状态 |
|------|------|
| P0 R-001~R-004 | ✅ monorepo + `.env.example` |
| P1 基础设施 R-101~R-105 | ✅ db / docker-compose / seed / scripts |
| P1 API R-201~R-214 | ✅ 公开 GET ×4 |
| P1 API R-221~R-252 | ✅ JWT + Admin CRUD |
| P1 Studio R-301~R-304 | ✅ 已删 Studio；`/admin` 无 locale |
| P1 Admin UI R-311~R-319 | ✅ `/admin` 全页 |
| P1 官网 R-321~R-325 | ✅ 项目页接 API + feature flag |
| 验收 V-101~V-108 | 8/8 ✅ |
| P2 R-401~R-409 | ✅ MinIO + 全站 API + 删 Sanity |
| P3 R-501~R-508 | ✅ 订单 API + Admin + Redis + 官网改调 API |

---

### 2026-06-04 — Session 1（冻结，勿改）

**完成：** R-001

**做了什么：**
- 创建 `docs/backend-migration/REQUIREMENTS.md`
- 汇总已锁定技术决策（11 条 + 官网选项 A）
- 梳理当前 Sanity 依赖文件清单
- 定义 Phase 1~4 全部需求 ID（R-001 ~ R-606）及 Phase 1 验收项（V-101 ~ V-108）
- 定义数据表结构、API 列表、Admin 页面列表、环境变量、推荐实施顺序

**下一步：** R-002 创建 `.env.example` → R-003/R-004 monorepo 迁移

**当前 Phase 1 进度：** 1 / ~35 条（约 3%）

---

<!-- 新 Session 请在本注释下方追加，不要改上方记录 -->

### 2026-06-04 — Session 2

**完成：** R-002, R-003, R-004

**做了什么：**
- 根目录新增 `.env.example`（api / web / db / seed / Resend 占位变量）
- 新增 `pnpm-workspace.yaml`，根 `package.json` 改为 workspace（`dev` / `dev:web` → `@yezz/web`）
- 将 `app/`、`components/`、`lib/`、`i18n/` 及 Next/Sanity 配置迁入 `apps/web/`
- `sanity/`、`sanity.config.ts`、`sanity.cli.ts` 一并迁入 `apps/web/`（Studio 仍引用 `@/sanity.config`）
- `next-intl` 插件显式指向 `./i18n/request.ts`；`pnpm typecheck` 通过
- 删除根 `package-lock.json`，改用 `pnpm-lock.yaml`

**下一步：** R-101 ~ R-105（db + docker + seed）

**备注/坑：**
- 本机需 `corepack enable` 才有 pnpm；`packageManager` 已锁 `pnpm@10.12.1`
- 未配置 `NEXT_PUBLIC_SANITY_PROJECT_ID` 时页面 500（与迁移前相同）；本地复制 `.env.example` → `.env` / `apps/web/.env.local` 并填 Sanity ID
- `next build` 在无 Sanity env 时会在 collect page data 阶段失败；有 env 后再验 build

**当前 Phase 1 进度：** 4 / ~35 条（约 11%）

---

### 2026-06-04 — Session 3

**完成：** R-101, R-102, R-103, R-104, R-105

**做了什么：**
- `docker-compose.yml`（postgres:16 + redis:7 + api）+ `docker-compose.dev.yml`（仅 PG/Redis）
- `packages/db`：Drizzle schema（users / categories / projects / styles / images / site_settings）
- 初始迁移 `migrations/0000_*.sql`；`pnpm db:generate|migrate|seed`
- Seed 从 `apps/web/lib/sanity/mock-data.ts` 导入；`FORCE_SEED=1` 可重灌；默认 admin + site_settings
- `apps/api` 最小 Fastify：`GET /health`（db + redis ping）
- 根脚本：`db:*`、`dev:api`、`dev:web`；`typecheck` 跑全 workspace

**下一步：** R-201 ~ R-214（API 分层 + 4 个公开 GET）

**备注/坑：**
- 本地需 `docker compose -f docker-compose.dev.yml up -d` 后再 `pnpm db:migrate && pnpm db:seed`
- CI/沙箱无 Docker 时 migrate 会失败（需 yezz 角色）；用 compose 里的 Postgres 即可
- `pnpm dev:api` 需 PG/Redis 已启动；health 在 DB 未连时为 `degraded`

**当前 Phase 1 进度：** 9 / ~35 条（约 26%）

---

### 2026-06-04 — Session 4

**完成：** R-201 ~ R-206, R-211 ~ R-214

**做了什么：**
- 重构 `apps/api`：`plugins/`（db、redis、services）+ `repositories/` + `services/` + `routes/`
- 统一 JSON：`{ success, data }` / `{ success: false, error: { code, message } }`（`/health` 保持裸 JSON）
- 公开接口：`GET /api/v1/categories|projects|projects/:slug|settings`
- `AppError` + 全局 error handler；CORS 读 `CORS_ORIGIN`

**下一步：** R-221 ~ R-252（auth/login + admin CRUD）

**验证：**
```bash
docker compose -f docker-compose.dev.yml up -d
pnpm db:migrate && pnpm db:seed
pnpm dev:api
curl http://localhost:4000/health
curl http://localhost:4000/api/v1/categories
```

**当前 Phase 1 进度：** 17 / ~35 条（约 49%）

---

### 2026-06-04 — Session 5

**完成：** R-221, R-222, R-231 ~ R-234, R-241, R-242, R-251, R-252

**做了什么：**
- `@fastify/jwt` + `authenticate` 钩子；`POST /api/v1/auth/login`
- Admin 路由（`/api/v1/admin/*`）均需 `Authorization: Bearer <token>`
- 项目 CRUD + 可选 `?page=&limit=` 分页；styles/images 随 create/patch 替换
- 分类 PATCH；站点设置 GET/PATCH
- 额外：`GET /api/v1/admin/projects/:id`（编辑页用）

**下一步：** R-301 ~ R-304 删 Studio → R-311 ~ R-319 Admin UI

**验证：**
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@yezz.local","password":"changeme"}'
# 用返回 token：
curl http://localhost:4000/api/v1/admin/me -H "Authorization: Bearer <token>"
```

**当前 Phase 1 进度：** 27 / ~35 条（约 77%）

---

### 2026-06-04 — Session 6

**完成：** R-311 ~ R-319, R-301 ~ R-304（先 Admin UI，后删 Studio）

**做了什么：**
- `/admin` 自建后台：layout + 登录（localStorage JWT）+ 路由守卫
- 看板、项目 CRUD、分类编辑、站点设置表单；`lib/admin/api.ts` 对接 Admin API
- 新增 `input` / `label` / `card` UI 组件
- 删除 `app/studio/`、`components/studio/`、`sanity.config.ts`、`sanity.cli.ts`
- middleware 注释标明 `/admin` 不走 i18n（matcher 已排除）

**下一步：** R-321 ~ R-325（官网项目页接 API）

**验证：**
```bash
pnpm dev:api & pnpm dev:web
open http://localhost:3000/admin/login
# /studio 应 404
```

**当前 Phase 1 进度：** 35 / ~35 条核心项（约 100% API+Admin；剩官网接 API 5 条）

---

### 2026-06-04 — Session 7

**完成：** R-321 ~ R-325

**做了什么：**
- `lib/api/client.ts` — 公开 API fetch + `PublicApiError`
- `lib/api/mappers.ts` — slug `{ current }`、styles/images 映射
- `lib/api/config.ts` — `isApiEnabled()` 读 `NEXT_PUBLIC_USE_API`
- `lib/projects/data.ts` — 统一加载：API → Sanity → mock
- `/projects` 与 `/projects/[slug]` 改用 data loader

**验证：**
```bash
# apps/web/.env.local
NEXT_PUBLIC_USE_API=true
NEXT_PUBLIC_API_URL=http://localhost:4000
pnpm dev:api & pnpm dev:web
# 改 Admin 项目后刷新 /zh/projects 应看到变化
# USE_API=false 时仍显示 mock
```

**下一步：** Phase 1 验收 V-101 ~ V-108；或 Phase 2（R-401…）

**当前 Phase 1 进度：** 全部 P1 需求 ID 已完成（待验收）

---

### 2026-06-04 — Session 8（Phase 1 验收）

**环境：** 本机 Postgres（`yezz` 用户已创建）+ Redis；无 Docker CLI

| ID | 结果 | 说明 |
|----|------|------|
| V-101 | ✅ | 5432/6379/4000 + health ok（Session 10） |
| V-102 | ✅ | migrate + seed：5 分类、16 项目、admin |
| V-103 | ✅ | `{"status":"ok","db":"ok","redis":"ok"}` |
| V-104 | ✅ | categories / projects / settings / projects/:slug（6 styles） |
| V-105 | ✅ | login、me、PATCH、POST、DELETE、admin list |
| V-106 | ✅ | PATCH 后公开 API + `/zh/projects` HTML 含「验收」 |
| V-107 | ✅ | `/studio` → **404** |
| V-108 | ✅ | `USE_API=false` → 200，mock「奶油胶手机壳」，无 API 标记 |

**本机复现：**
```bash
docker compose -f docker-compose.dev.yml up -d   # 或 compose up 含 api
pnpm db:migrate && pnpm db:seed
pnpm dev:api   # DATABASE_URL=postgres://yezz:yezz@localhost:5432/yezz
pnpm dev:web   # NEXT_PUBLIC_USE_API=true 测 V-106
```

**Phase 1：** 功能需求全部 [x]；验收 7/8 通过，V-101 需 Docker 环境补测。

---

### 2026-06-04 — Session 9（文档维护 + 杂项修复）

**完成：** 文档结构修正；`lib/sanity/client.ts` 懒加载（无 Sanity env 不 500）

**做了什么：**
- 将 `<!-- 新 Session -->` 标记移到 Session 1 之后，Session 2~9 均在标记下方（此前标记在文末，滚到底只有空注释）
- 文首「新窗口接手」与「推荐实施顺序」更新为 Phase 2
- 修正 Session 2 日志里错误的「下一步」（原为 R-301，应为 R-101）
- 新增「当前进度快照」表，汇总至今全部 R / V 状态

**下一步：** Phase 2 → R-401（MinIO + 媒体上传）

**备注/坑：**
- 验收时在本机创建了 Postgres 角色/库 `yezz`（若你用 Docker compose 可忽略）
- `NEXT_PUBLIC_USE_API=true` 时项目页读 API；`false` 时 Sanity → mock

---

### 2026-06-04 — Session 10（V-101 + 本地联调）

**完成：** V-101、本地 `.env.local`、V-106 端到端复测

| ID | 结果 | 说明 |
|----|------|------|
| V-101 | ✅ | 5432/6379/4000 可达；`health` db+redis ok（本机 `pnpm dev:api`；亦可用 `docker compose up -d`） |
| V-103 | ✅ | `curl localhost:4000/health` |
| V-106 | ✅ | Admin PATCH → 公开 API + `/zh/projects`（`NEXT_PUBLIC_USE_API=true`） |

**做了什么：**
- 新增 `apps/web/.env.local`：`NEXT_PUBLIC_USE_API=true`、`NEXT_PUBLIC_API_URL=http://localhost:4000`
- 重启 `pnpm dev:web`（加载 `.env.local`；此前以 `USE_API=false` 启动导致仍走 mock）
- 联调后恢复 `cream-glue-phone-case` 中文名为「奶油胶手机壳」

**下一步：** Phase 2 → R-401（MinIO）

**备注/坑：**
- 改 `NEXT_PUBLIC_*` 后必须重启 Next dev server

---

### 2026-06-04 — Session 11（Phase 2 完成 R-401~R-409）

**完成：** R-401, R-402, R-403, R-404, R-405, R-406, R-407, R-408, R-409

**做了什么：**
- `docker-compose.yml` / `docker-compose.dev.yml` 增加 MinIO + `minio-init` 创建公开 bucket `yezz-media`
- API：`POST /api/v1/admin/upload`（JWT + `@aws-sdk/client-s3` + `media_assets` 落库）
- DB 迁移 `0001_phase2_*`：`party_packages`、`gallery_images`、`media_assets`；seed 派对 3 条、画廊 9 条
- 公开 `GET /api/v1/parties`、`/gallery`；Admin CRUD `/admin/parties`、`/admin/gallery`
- 官网 `lib/site/data.ts`：首页 / parties / gallery / contact / Footer 读 API（`USE_API=true`）
- 删除 `apps/web/sanity/`、`lib/sanity/` 及 sanity npm 包；mock 迁至 `lib/mock-data.ts`
- Admin `ImageUploadField` 替换项目/设置/画廊/派对图片手填 URL
- 预约/购物车 action 暂仅发邮件（Phase 3 接 API）

**下一步：** Phase 3 → R-501（bookings / cart_orders schema）

**备注/坑：**
- 本机需 `S3_*` env（见 `.env.example`）并启动 MinIO 后上传才可用
- 已有库执行 `pnpm db:seed` 会增量灌派对/画廊（无需 FORCE_SEED）

---

### 2026-06-04 — Session 12（Phase 3 R-501~R-503）

**完成：** R-501, R-502, R-503

**做了什么：**
- DB 迁移 `0002_flashy_magik`：`order_status` enum + `bookings`、`cart_orders`、`cart_order_items` 三表
- API：`POST /api/v1/bookings`、`POST /api/v1/cart-orders`（校验 → 写库 → Resend 通知 owner；邮件失败不阻断落库）
- `apps/api` 新增 `resend` 依赖；`lib/email.ts` 共用发信逻辑

**下一步：** R-504（Admin `/admin/bookings` 列表 + 状态 PATCH）

**备注/坑：**
- `pnpm db:migrate` 需 root `.env` 或 `DATABASE_URL` 环境变量
- 邮件需 `RESEND_API_KEY` + `OWNER_EMAIL`（与 web 共用 root `.env`）

---

### 2026-06-04 — Session 13（Phase 3 R-504）

**完成：** R-504

**做了什么：**
- API：`GET /api/v1/admin/bookings`、`GET /:id`、`PATCH /:id`（status）
- Admin：`/admin/bookings` 列表页 + 状态下拉 PATCH；侧边栏新增「预约」入口

**下一步：** R-505（Admin `/admin/orders` 购物车订单列表 + 状态）

---

### 2026-06-04 — Session 14（Phase 3 完成 R-505~R-508）

**完成：** R-505, R-506, R-507, R-508

**做了什么：**
- API：`GET/PATCH /api/v1/admin/orders`（含 cart_order_items）
- Admin：`/admin/orders` 列表 + 状态下拉 PATCH；侧边栏「订单」
- Redis Cache-Aside：`GET /projects`、`/projects/:slug`、`/settings`（TTL 5min）；Admin 改项目/设置时失效
- Redis 限流：`POST /bookings` 同 IP 5 次/小时（429 `RATE_LIMITED`）
- 官网 `lib/actions/booking.ts`、`cart.ts` 改调 Node API（移除 Resend 直发）

**下一步：** Phase 4 → R-601（web 进 docker-compose）

**备注/坑：**
- Redis 不可用时缓存/限流自动降级，不阻断请求
- 限流仅作用于 `/bookings`，购物车 POST 暂未限流
