# YEZZ 后端整体评估报告

> **视角：** 后端开发（架构 / 安全 / 性能 / 运维）
> **评估日期：** 2026-06-17
> **评估范围：** `apps/api`、`packages/db`、`docker-compose.yml`、CI 流水线及关联前端数据层

---

## 执行摘要

当前后端**骨架健康、分层清晰、CI 完整**，已具备支撑业务的基础能力。但在**安全边界、业务约束完整性、可观测性**三个维度上，尚未达到可承受真实流量的生产标准。

**建议节奏：**
- **第 1 周：** 修复 5 个安全底线问题（Swagger 暴露、登录爆破、Cart IDOR、密码明文返回、MIME 绕过）
- **第 2 周：** 补齐 3 个业务约束（取消回滚容量、容量非负检查、日期字段类型统一）
- **第 3 周：** 增强工程体验（请求体验证 schema、诚实健康检查、邮件重试）
- **第 4 周：** 接入可观测性（错误监控、请求追踪 ID）

---

## 1. 架构概览

### 1.1 技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| API 框架 | Fastify 5.x | 插件体系成熟，性能优异 |
| ORM | Drizzle ORM + postgres-js | 类型安全，schema 即代码 |
| 数据库 | PostgreSQL 16 | 主业务库 |
| 缓存 / 限流 | Redis 7 + ioredis | 支持降级到内存限流 |
| 对象存储 | MinIO（S3 兼容） | 本地开发/测试用 |
| 邮件 | Resend | 事务邮件 |
| 容器 | Docker + Docker Compose | 本地一键启动 |
| 部署 | Fly.io | `fly.toml` 已配置 |
| CI/CD | GitHub Actions | lint → typecheck → unit → build → E2E |

### 1.2 目录结构

```
apps/api/src/
├── app.ts              # Fastify 实例组装
├── index.ts            # 入口
├── env.ts              # dotenv 加载
├── lib/                # 工具函数（cache、email、errors、jwt、validation...）
├── plugins/            # Fastify 插件（auth、db、redis、services、swagger、error-handler）
├── repositories/       # 数据访问层（每实体一个）
├── routes/v1/          # 路由层
│   ├── admin/          # 后台管理路由（带认证 + 限流）
│   └── ...             # 公开路由
└── services/           # 业务逻辑层
    ├── admin/          # 后台业务服务
    └── ...             # 公开业务服务

packages/db/src/
├── schema/index.ts     # Drizzle schema 定义
├── client.ts           # DB 连接封装
├── migrate.ts          # 迁移执行
└── seed.ts             # 种子数据
```

### 1.3 数据流

```
HTTP Request
    → Fastify Route
        → authenticate / rateLimit (hook)
            → Service (业务逻辑)
                → Repository (SQL 构建)
                    → PostgreSQL
                → Redis (缓存 / 限流)
            → Email (Resend)
        ← Response ( standardized { success, data | error } )
```

---

## 2. 做得好的地方

### 2.1 分层与边界

- **Repository + Service + Route 三层分离**，没有业务逻辑泄漏到路由层
- **Admin 路由做了子 scope 隔离**：`app.requireAdmin` 只在 `/admin` 下的特定子路由注册，比每个路由手工判断更不易遗漏
- **Plugin 化设计**：db、redis、auth、services 都是独立 Fastify plugin，便于测试替换

### 2.2 数据库设计

- Schema 定义完整，外键约束、唯一索引、默认值到位
- **关键业务用了事务**：`bookings.service.ts` 创建预约时，对 time_slot 做 `SELECT FOR UPDATE` 后扣减容量，避免超售竞态条件
- **Partial index 有优化意识**：`idx_bookings_is_read WHERE is_read = false` 对 Admin 未读通知列表非常高效

### 2.3 防御性细节

- **Redis 降级策略**：`lib/cache.ts` 中 Redis 不可用时自动切换到内存限流，服务不崩
- **CORS 分环境配置**：production 严格白名单，dev 额外放行 `192.168.x.x` 等内网段
- **邮件失败不阻断流程**：`sendOwnerEmail` / `sendBookingConfirmationToCustomer` catch 住只打日志，用户体验优先

### 2.4 工程化

- GitHub Actions 流水线完整，E2E 测试在 CI 中跑真实 PostgreSQL + Redis
- Docker Compose 本地开发体验好，healthcheck 配置到位
- API Dockerfile 是生产构建（`tsc` 编译后运行 `dist/index.js`），不是 tsx 直跑

---

## 3. 风险矩阵

### 3.1 🔴 安全类（阻断上线）

| ID | 问题 | 位置 | 影响 | 修复成本 |
|----|------|------|------|----------|
| SEC-005 | Swagger UI 公开暴露 | `plugins/swagger.ts` 无条件注册 | 攻击者拿到全量 API 文档和路由结构 | 低（加环境开关） |
| SEC-001 | 登录无暴力破解保护 | `routes/v1/auth.routes.ts` | Admin 账号可被暴力破解，全局沦陷 | 低（复用 `checkRateLimit`） |
| SEC-006 | Cart Session IDOR | `routes/v1/cart.routes.ts` | 知道 UUID 即可操作用户 B 的购物车 | 中（绑定 cookie / ipHash） |
| SEC-003 | 新建用户密码明文返回 | `services/admin/users.admin.service.ts` | 密码在 HTTP 响应中裸奔，合规硬伤 | 低（只返回一次，去掉序列化） |
| SEC-004 | 文件上传 MIME 可绕过 | `services/admin/upload.admin.service.ts` | 可能上传恶意文件 | 中（校验 magic bytes） |

### 3.2 🟠 业务逻辑类（体验杀手）

| ID | 问题 | 位置 | 影响 |
|----|------|------|------|
| BIZ-001 | 取消预约不归还容量 | `services/admin/bookings.admin.service.ts` | 时段实际有空位但显示已满，用户流失 |
| BIZ-002 | 无时段 ID 跳过容量检查 | `services/bookings.service.ts` | `activityType !== 'experience'` 时不校验 time_slot，可超售 |
| BIZ-003 | 容量可设低于已预约数 | `packages/db/src/schema/index.ts` | 数据混乱，导致负容量 |
| BIZ-005 | 订单不校验商品存在性和价格 | `services/cart-orders.service.ts` | 可提交价格为 0 或已下架商品的订单 |
| ENG-008 | 日期字段混合类型 | `cartOrderItems.date` 为 varchar | 无法做"本月订单"查询，报表困难 |

### 3.3 🟡 工程与运维类（运营拖累）

| ID | 问题 | 位置 | 影响 |
|----|------|------|------|
| OPS-001 | 无错误监控 | 全局 | 生产 500 只能看日志，被动发现 |
| OPS-002 | 无结构化日志 + 请求追踪 | 全局 | 排查问题无法串联前后端日志 |
| ENG-003 | 健康检查不够诚实 | `routes/health.routes.ts` | 可能 DB 已断开仍返回 200，误导监控 |
| ENG-005 | 路由无请求体验证 schema | 全局 | 全靠 service 层手工判空，类型不同步 |
| ENG-007 | Admin 列表无分页 | 多个 admin list 接口 | 数据量大了页面卡死 |
| ENG-001 | 生产 API 容器运行 Node 直接启动 | `Dockerfile` CMD | 无进程管理，崩溃后不会自动重启 |

---

## 4. 详细分析与建议

### 4.1 安全加固

#### SEC-005：关闭 Swagger UI

**现状：** `@fastify/swagger` 和 `@fastify/swagger-ui` 在 `buildApp()` 中无条件注册。

**建议：**

```typescript
// plugins/swagger.ts
export default fp(async (app: FastifyInstance) => {
  if (process.env.NODE_ENV === "production") {
    return; // 生产环境不注册 Swagger
  }
  // ... 注册 swagger
});
```

或增加 `ENABLE_SWAGGER=false` 环境变量控制。

#### SEC-001：登录限流

**现状：** `/api/v1/auth/login` 没有任何 rate limit。

**建议：** 复用现有的 `checkRateLimit`，限制同一 IP 5 次/15 分钟：

```typescript
const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW = 15 * 60; // 15 minutes
```

#### SEC-006：Cart Session 安全

**现状：** Cart 只校验 session UUID，不验证请求者是否有权操作该 session。

**建议（最小改动）：**
- 在 `cart_sessions` 表中增加 `ipHash` 字段（`varchar(64)`）
- 创建 session 时写入 `crypto.createHash('sha256').update(request.ip).digest('hex')`
- 后续操作时校验 `ipHash` 匹配，不匹配则视为新 session

**建议（更完善）：**
- 将 cart session 与用户登录态解耦，session ID 只存 cookie，服务端不额外校验 IP（因为用户可能切换网络）
- 但**必须**确保 cookie 是 `httpOnly` + `secure`（production）+ `sameSite=lax`

#### SEC-003：密码不返回

**现状：** `createAdminUser` 和 `resetAdminUserPassword` 的响应中包含 `initialPassword` / `newPassword`，且 `user` 对象可能包含 `passwordHash`。

**建议：**
- 响应中只返回 `{ user: safeUser, initialPassword: string }`，确保 `safeUser` 已经 `omit(passwordHash)`
- 或者更安全：密码只通过邮件发送，API 响应中完全不返回密码字段

#### SEC-004：文件上传 MIME 校验

**现状：** 只检查 `file-type` 的 MIME，可被伪造扩展名绕过。

**建议：** 增加 magic bytes 校验 + 文件大小上限 + 扩展名白名单。

---

### 4.2 业务逻辑修复

#### BIZ-001：取消预约归还容量

**建议修改点：** `services/admin/bookings.admin.service.ts`

```typescript
// 在 updateStatus 方法中
if (newStatus === "cancelled" && oldStatus !== "cancelled") {
  if (booking.timeSlotId && booking.numberOfPeople) {
    await slotsRepo.incrementBookedCount(
      booking.timeSlotId,
      -booking.numberOfPeople,
      tx
    );
  }
}
```

#### BIZ-003：容量非负约束

**建议 Migration：**

```sql
ALTER TABLE time_slots ADD CONSTRAINT chk_capacity_non_negative
  CHECK (capacity >= booked_count AND booked_count >= 0);
```

#### ENG-008：统一日期字段类型

**现状：** `cartOrderItems.date` 是 `varchar(32)`，`bookings.preferredDate` 是 `date`。

**建议：** 将 `cartOrderItems.date` 改为 `date` 类型，并在前端/服务端统一格式处理。

---

### 4.3 工程体验提升

#### ENG-005：引入请求体验证 Schema

Fastify 原生支持 JSON Schema 验证，成本极低。从最关键的 `POST /bookings` 开始：

```typescript
app.post<{ Body: BookingCreateInput }>(
  "/",
  {
    schema: {
      body: {
        type: "object",
        required: ["name", "phone"],
        properties: {
          name: { type: "string", minLength: 1 },
          phone: { type: "string", minLength: 1 },
          email: { type: "string", format: "email" },
        },
      },
    },
  },
  async (request, reply) => { ... }
);
```

#### ENG-003：诚实健康检查

**现状：** `/health` 可能只返回固定 200。

**建议：** 检查下游依赖：

```typescript
app.get("/health", async (_request, reply) => {
  const checks = await Promise.all([
    db.execute("SELECT 1").then(() => true).catch(() => false),
    redis.ping().then(() => true).catch(() => false),
  ]);
  const healthy = checks.every(Boolean);
  return reply.status(healthy ? 200 : 503).send({
    status: healthy ? "healthy" : "unhealthy",
    checks: { db: checks[0], redis: checks[1] },
  });
});
```

#### OPS-002：请求追踪 ID

**建议：** 在 `app.ts` 中配置 Fastify 的 genReqId：

```typescript
const app = Fastify({
  logger: true,
  genReqId: () => crypto.randomUUID(),
});
```

并在 CORS 暴露 `X-Request-Id` header，前端可在报错时将此 ID 带给客服。

---

### 4.4 可观测性

#### OPS-001：接入错误监控

**建议方案（轻量）：**
- 接入 Sentry（`@sentry/node`），在 `plugins/error-handler.ts` 中 `captureException(error)`
- 或使用 Logtail / Better Stack 等结构化日志服务

**建议方案（自建）：**
- 统一 error response 格式，增加 `requestId`
- 关键路径（booking、order、upload）打结构化日志

---

## 5. 与前端数据层改造的协作点

前端计划迁移到 **TanStack Query + Zustand**（见 `2026-06-17-frontend-data-layer-migration.md`）。Backend 需要配合的改动很小：

| 前端需求 | Backend 配合 |
|----------|-------------|
| 乐观更新 | PATCH/PUT 响应返回**完整更新后实体**，而不是 `{ success: true }`，减少一次 invalidate 后的 refetch |
| 自动重试 | 保证 API 的幂等性（如 booking 创建用客户端生成的 idempotency key） |
| 错误标准化 | 保持现有的 `{ success: false, error: { code, message } }` 格式即可 |

**建议新增：** 在关键写操作（booking、order）支持 `Idempotency-Key` header，防止用户网络抖动时的重复提交。

---

## 6. 验收标准

完成上述修复后，应满足：

- [ ] `pnpm test:api` 全部通过
- [ ] `pnpm typecheck` 零错误
- [ ] E2E 测试通过（`cart.spec.ts`, `booking.spec.ts`, `admin-booking.spec.ts`）
- [ ] Swagger UI 在生产环境不可访问
- [ ] 暴力破解 5 次后登录接口返回 429
- [ ] 取消预约后对应 time_slot 的 `booked_count` 正确回滚
- [ ] 健康检查在 Redis 断开时返回 503
- [ ] 生产环境 API 不返回任何密码字段

---

## 7. 附录：原始问题对照

本报告中的问题编号与产品优先级审计报告（`2026-06-17-product-priority-audit.md`）中的 backend 相关 issue 对应：

| 本报告 ID | 审计报告 ID | 类别 |
|-----------|-------------|------|
| SEC-005 | SEC-005 | 阻断上线 |
| SEC-001 | SEC-001 | 阻断上线 |
| SEC-006 | SEC-006 | 阻断上线 |
| SEC-003 | SEC-003 | 阻断上线 |
| SEC-004 | SEC-004 | 阻断上线 |
| BIZ-001 | BIZ-001 | 体验杀手 |
| BIZ-002 | BIZ-002 | 体验杀手 |
| BIZ-003 | BIZ-003 | 体验杀手 |
| BIZ-005 | BIZ-005 | 运营拖累 |
| ENG-008 | ENG-008 | 运营拖累 |
| OPS-001 | OPS-001 | 运营拖累 |
| OPS-002 | OPS-002 | 运营拖累 |
| ENG-003 | ENG-003 | 运营拖累 |
| ENG-005 | ENG-005 | 增长障碍 |
| ENG-007 | ENG-007 | 运营拖累 |

---

> **结论：** 后端骨架扎实，但安全底线和业务约束需要在上线前补齐。建议按"安全 → 业务 → 工程 → 监控"的顺序分 4 周推进，每周都有明确的可交付物。
