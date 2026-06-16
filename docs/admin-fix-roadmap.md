# Admin 系统 P0/P1 修复排期

> 生成时间: 2026-06-16
> 覆盖范围: P0（4 项）+ P1（1 项）共 5 个大问题，拆分为 14 个可执行任务
> 预估总工期: 1 人日 ~ 1.5 人日（按顺序串行，部分可并行）

---

## 一、排期总览

| 阶段 | 任务编号 | 任务名 | 优先级 | 预估时长 | 依赖 |
|------|----------|--------|--------|----------|------|
| 1 | T1 | Cookie maxAge 单位修复 | P0 | 10 min | — |
| 1 | T2 | NaN 参数校验统一处理 | P0 | 30 min | — |
| 2 | T3 | `initialPassword` 返回修复 | P0 | 15 min | — |
| 2 | T4 | ProjectForm `useRouter` 补导入 | P0 | 5 min | — |
| 3 | T5 | Admin API Rate Limit 中间件 | P1 | 90 min | — |
| 3 | T6 | 为各路由注册 Rate Limit | P1 | 30 min | T5 |
| 4 | T7 | 全量回归验证 | — | 30 min | T1~T6 |

> **阶段说明**：T1/T2 可并行；T3/T4 可并行；T5/T6 有先后依赖；T7 必须在最后。

---

## 二、P0 任务详细拆分

### T1 — Cookie maxAge 单位修复

**关联文件**
- `apps/api/src/routes/v1/auth.routes.ts`

**现状问题**
```ts
// 第 21 行：86400 毫秒 = 86.4 秒
maxAge: 60 * 60 * 24,
```

**任务清单**
- [ ] 将 `setAuthCookie` 中的 `maxAge` 改为毫秒单位：`60 * 60 * 24 * 1000`（24 小时）
- [ ] 同步检查 `clearAuthCookie` 是否也需要调整（通常不需要，只是清理）
- [ ] 验证 `JWT_EXPIRES_IN` 环境变量默认也是 24h，确保两者一致
- [ ] 本地登录后等待 2 分钟，确认 cookie 仍然有效

**验收标准**
- 登录后 cookie 有效期为 24 小时（可在浏览器 DevTools → Application → Cookies 中查看 Expires/Max-Age）
- 86.4 秒后不会自动登出

**预估**: 10 min

---

### T2 — NaN 参数校验统一处理

**关联文件**
- `apps/api/src/routes/v1/admin/bookings.routes.ts`
- `apps/api/src/routes/v1/admin/projects.routes.ts`
- `apps/api/src/routes/v1/admin/time-slots.routes.ts`

**现状问题**
```ts
// bookings.routes.ts
page: request.query.page ? Number(request.query.page) : undefined,
// 如果传入 ?page=abc，Number("abc") = NaN，Math.max(1, NaN) = NaN，OFFSET NaN 导致 SQL 报错

// time-slots.routes.ts
capacity: Number(body.capacity ?? 0),
// 如果传入 "abc"，capacity = NaN，直接入库或导致后续计算异常
```

**任务清单**
- [ ] 在 `apps/api/src/lib/validation.ts`（或同级目录）新增一个工具函数 `parsePositiveInt(value: unknown, fallback: number): number`
  - 逻辑：`Number(value)` → 如果 `isNaN` 或 `<= 0`，返回 `fallback`，否则返回该数字
- [ ] `bookings.routes.ts`: 用 `parsePositiveInt` 替换 `page` 和 `limit` 的 `Number()` 转换
- [ ] `projects.routes.ts`: 同上处理 `page` 和 `limit`
- [ ] `time-slots.routes.ts`: 
  - `capacity` 用 `parsePositiveInt` 处理
  - `body.weekdays.map((d) => Number(d))` 也需要校验，过滤掉 `NaN`
  - `body.slots` 数组中的对象校验 `startTime`/`endTime` 是否为非空字符串

**验收标准**
- 调用 `GET /admin/bookings?page=abc&limit=-1` → 正常返回第 1 页，limit=1（或 100 默认值），不抛 500
- 调用 `POST /admin/time-slots` 传入 `{ capacity: "xyz" }` → 使用默认值 0 或返回 400 校验错误
- 所有相关单元测试（如有）通过

**预估**: 30 min

---

### T3 — `initialPassword` 返回修复

**关联文件**
- `apps/api/src/services/admin/users.admin.service.ts`
- `apps/api/src/routes/v1/admin/users.routes.ts`（可选，检查类型是否一致）
- `apps/web/lib/admin/types.ts`（确认前端类型）

**现状问题**
```ts
// users.admin.service.ts 第 44 行
Promise<{ user: AdminUserDto }>  // ❌ 缺少 initialPassword

// 第 79 行
return { user: { ... } };         // ❌ 没把 initialPassword 带出去
```

**任务清单**
- [ ] 修改 `create` 方法的返回类型：`Promise<{ user: AdminUserDto; initialPassword: string }>`
- [ ] 修改 `return` 语句，把 `initialPassword` 一并返回
- [ ] 检查 `users.routes.ts` 是否有类型冲突（Fastify 的 `success(data)` 通常是泛型，大概率无冲突）
- [ ] 前端 `AdminUsersPage` 已有 `result.initialPassword` 调用，确认无需改动

**验收标准**
- 在 Admin 后台创建一个新用户
- 创建成功后页面正确显示"初始密码：xxxx"
- 浏览器 Network 面板中，`POST /api/v1/admin/users` 的响应体包含 `initialPassword` 字段

**预估**: 15 min

---

### T4 — ProjectForm `useRouter` 补导入

**关联文件**
- `apps/web/components/admin/ProjectForm.tsx`

**现状问题**
```tsx
// 第 297 行
<Button ... onClick={() => router.back()}>取消</Button>
// ❌ 没有 import { useRouter } from "next/navigation"
```

**任务清单**
- [ ] 在文件顶部添加 `import { useRouter } from "next/navigation";`
- [ ] 在组件内 `const router = useRouter();`（通常在 `useFormSubmit` 附近）
- [ ] 检查 `PartyForm.tsx` 是否也有同样问题（快速扫一眼，有则一起修）

**验收标准**
- 进入 Project 编辑页 → 点击"取消"按钮 → 正常返回上一页，不报错
- `next build` 编译通过（如未通过通常是类型问题）

**预估**: 5 min

---

## 三、P1 任务详细拆分

### T5 — Admin API Rate Limit 中间件开发

**关联文件**
- `apps/api/src/lib/cache.ts`（已有 `checkRateLimit`，需扩展）
- `apps/api/src/plugins/`（可能需要新建 rate-limit.ts）
- `apps/api/src/app.ts`（注册插件）

**现状问题**
- 只有 `/auth/login` 有 rate limit
- 其余所有 admin 接口（上传、CRUD、查询）均无限制

**任务清单**
- [ ] **方案选型**（二选一，推荐方案 A）：
  - **方案 A（轻量）**: 基于现有 `checkRateLimit`，在 `apps/api/src/plugins/` 新建一个 Fastify `onRequest` hook，按 IP + 路由维度限速
  - **方案 B（标准）**: 引入 `@fastify/rate-limit` 插件，功能更全（支持 Redis、自定义 key、header 提示）
- [ ] 如果选方案 A：
  - 新建 `apps/api/src/plugins/rate-limit.ts`
  - 导出一个 hook 函数，接收 `{ limit, windowSeconds }` 参数
  - 内部调用 `checkRateLimit(app.redis, key, limit, windowSeconds)`
  - key 生成规则：`rl:${request.ip}:${request.routerPath}`
- [ ] 如果选方案 B：
  - `pnpm add @fastify/rate-limit`
  - 在 `app.ts` 中 `app.register(rateLimit, { ... })`
  - 配置全局默认限速，再对 `/upload` 单独设更严格的规则
- [ ] 配置建议限速策略：

| 路由模式 | 限制 | 窗口 | 说明 |
|---------|------|------|------|
| `POST /upload` | 50 次 | 1 小时 | 防止恶意刷存储 |
| 其他 `POST/PATCH/DELETE` | 200 次 | 1 小时 | 防止批量篡改数据 |
| 所有 `GET` | 300 次 | 1 小时 | 防止爬虫抓取 |
| `/auth/login` | 保持现状 | 5 次/小时 | 已有，不动 |

**验收标准**
- 用脚本/Postman 快速请求同一 admin GET 接口 300+ 次 → 第 301 次返回 `429 Too Many Requests`
- 429 响应中包含 `Retry-After` header
- Rate limit 在 Redis 可用时走 Redis，不可用时回退到内存（复用现有逻辑）

**预估**: 90 min（含方案选型、实现、本地测试）

---

### T6 — 为各路由注册 Rate Limit

**关联文件**
- `apps/api/src/routes/v1/admin/index.ts`
- 各子路由文件（`upload.routes.ts` 等）

**任务清单**
- [ ] 在 `admin/index.ts` 中为所有路由统一添加一个通用 rate limit hook（如 300/hour）
- [ ] 在 `upload.routes.ts` 中单独覆盖更严格的限制（如 50/hour）
- [ ] 确认 `/auth/login` 的独立限制不受影响（它不在 `admin/` 路由组内，应该没事）
- [ ] 如果选方案 B（`@fastify/rate-limit`），则不需要逐一手动注册，只需在全局配置中按 prefix 覆盖即可

**验收标准**
- 访问 `/api/v1/admin/projects` 超过阈值后触发 429
- 访问 `/api/v1/admin/upload` 有更低的阈值
- 正常操作（如点击保存）不会误杀

**预估**: 30 min（依赖 T5 完成）

---

## 四、执行顺序建议

```
Day 1 上午（1 小时）
├── T1  Cookie maxAge（10 min）
├── T4  ProjectForm useRouter（5 min）
├── T3  initialPassword 返回（15 min）
└── T2  NaN 校验（30 min）
    └── 可顺带把 time-slots 的健壮性一起做了

Day 1 下午（2 小时）
├── T5  Rate Limit 中间件开发（90 min）
├── T6  路由注册与测试（30 min）
└── T7  全量回归（30 min）
```

> T1~T4 彼此独立，上午可快速扫清所有 P0。T5/T6 是 P1，需要集中时间设计和测试。

---

## 五、回归验证清单（T7）

在全部改动完成后，按以下顺序验证：

- [ ] **登录持久化**: 登录后等待 5 分钟，刷新页面，确认仍保持登录态
- [ ] **Cookie 查看**: DevTools → Application → Cookies → `token` 的 Max-Age 应为 `86400000`（ms）或对应 24h 的秒数
- [ ] **ProjectForm 取消**: 编辑任意 Project → 点击"取消" → 正常返回列表页
- [ ] **创建用户**: Admin 后台 → 用户 → 新建 staff → 页面正确显示初始密码
- [ ] **Bookings 分页容错**: `GET /api/v1/admin/bookings?page=abc` → 不报错，正常返回列表
- [ ] **TimeSlots 创建**: 传入非法 capacity → 使用默认值或返回 400
- [ ] **Rate Limit 触发**: 快速刷新 `/api/v1/admin/bookings` 300+ 次 → 收到 429
- [ ] **Rate Limit 恢复**: 等待窗口期后 → 请求恢复正常
- [ ] **全量 build**: `pnpm build`（或 `next build` + `tsc`）无类型错误

---

## 六、风险与注意事项

1. **Cookie maxAge 单位确认**
   - fastify-cookie 的 `maxAge` 历史上曾有版本差异。改完后务必用浏览器 DevTools 直接看 cookie 过期时间，不要只看代码。

2. **Rate Limit 误杀正常用户**
   - 如果多个运营人员共享同一外网 IP（如公司 NAT），按 IP 限速可能会误杀。上线后观察几天日志，如果频繁触发 429，可把 key 改为 `ip + userId` 组合。

3. **time-slots 的 `Record<string, unknown>`**
   - T2 只做基础 NaN 过滤，不做全面 schema 校验。如果后续需要更严格的输入校验，建议引入 `zod` 做统一校验层，属于独立迭代。

4. **环境变量**
   - 如果 T5 选方案 B（`@fastify/rate-limit`），确认不需要新增环境变量，或者文档中标注需要配置 `REDIS_URL`（可选，已有）。
