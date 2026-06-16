# YEZZ 上线部署修复排期表

> 本文档汇总部署检查中发现的 **P0（Critical）** 和 **P1（High）** 级别问题，按执行顺序拆分任务并给出排期建议。
>
> 总预估工时：**2 ~ 3 天（一个人全职）**

---

## Phase 1 — 紧急阻断项（上线前必须完成，约 0.5 天）

> 这些不改，上线等于裸奔，甚至会导致数据丢失。

### P0-1. 修复 `fly.toml` release_command 使用危险的 `migrate:fix`

- **影响**: 部署时可能自动 `DROP TABLE CASCADE` 摧毁生产数据库
- **文件**: `fly.toml`
- **改动量**: 1 行
- **验收标准**:
  - `release_command` 改为 `pnpm --filter @yezz/db run migrate`
  - 生产数据库只做增量迁移，绝不 drop 表
  - 本地文档写明：`migrate:fix` 仅限开发/全新 Staging 环境使用

---

### P0-2. 关闭 Next.js `ignoreBuildErrors`

- **影响**: 构建时隐藏类型错误，运行时可能直接崩溃
- **文件**: `apps/web/next.config.ts`
- **改动量**: 删除 3 行
- **验收标准**:
  - `typescript.ignoreBuildErrors` 配置移除
  - `pnpm typecheck` 在 `apps/web` 下完全通过零报错
  - 如有报错，逐个修复（不要重新打开这个开关）

---

### P0-3. Fastify 配置 `trustProxy`，修复 IP 获取问题

- **影响**: 所有基于 IP 的安全机制（登录限流、预订限流）在 Fly.io 后完全失效
- **文件**: `apps/api/src/app.ts`
- **改动量**: ~2 行
- **验收标准**:
  - `Fastify({ trustProxy: true })` 已添加
  - 在 Fly.io 部署后，日志中 `request.ip` 显示的是真实用户公网 IP，而非 `fdaa:*` 内网地址
  - 速率限制按真实 IP 生效

---

## Phase 2 — 安全与部署基础（上线前必须完成，约 1 天）

> 不改完这些，系统能跑但不安全、不稳定。

### P1-1. API Dockerfile 改为多阶段构建

- **影响**: 镜像包含 vitest/tsx/@types 等开发依赖，体积大、攻击面宽
- **文件**: `apps/api/Dockerfile`
- **改动量**: 重写 Dockerfile，~25 行
- **子任务拆分**:
  1. [ ] 创建 `builder` stage：安装全部依赖 → 编译 `packages/db` 和 `apps/api`
  2. [ ] 创建 `runner` stage：仅复制 `package.json/pnpm-lock.yaml/pnpm-workspace.yaml`
  3. [ ] `runner` stage 执行 `pnpm install --frozen-lockfile --prod`
  4. [ ] 从 `builder` 复制 `packages/db/dist` 和 `apps/api/dist`
  5. [ ] `runner` stage 使用非 root 用户运行
  6. [ ] 本地验证：`docker build -f apps/api/Dockerfile .` 成功且镜像能启动
  7. [ ] Fly.io 部署验证：部署后 `/health` 正常响应

---

### P1-2. 添加环境变量校验模块

- **影响**: 生产环境缺少关键配置时，启动后才发现，服务可能半残运行
- **文件**: 新建 `apps/api/src/env.ts`（替换现有同名文件），修改 `apps/api/src/index.ts`
- **改动量**: ~40 行
- **子任务拆分**:
  1. [ ] 在 `apps/api` 安装 `zod`（如未安装）
  2. [ ] 编写 `envSchema`，覆盖：
     - `DATABASE_URL` (URL 格式)
     - `JWT_SECRET` (最小 32 字符)
     - `NODE_ENV` (`development` | `production` | `test`)
     - `PORT` (数字，默认 4000)
     - `CORS_ORIGIN` (字符串)
     - `REDIS_URL` (可选，URL 格式)
     - `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL` (可选，但需同时存在)
     - `RESEND_API_KEY`, `OWNER_EMAIL` (可选)
  3. [ ] 在 `index.ts` 最顶部执行 `envSchema.parse(process.env)`
  4. [ ] 校验失败时进程立即退出并打印清晰错误
  5. [ ] 确保 dotenv 加载逻辑仍保留（或合并到校验模块中）

---

### P1-3. 添加 `@fastify/helmet` 安全头

- **影响**: 缺少 CSP / X-Frame-Options 等基础安全头，存在 XSS、点击劫持风险
- **文件**: `apps/api/src/app.ts`
- **改动量**: ~10 行
- **子任务拆分**:
  1. [ ] 安装 `@fastify/helmet`
  2. [ ] 在 `buildApp()` 中 `await app.register(helmet, { ... })`
  3. [ ] CSP 配置允许当前前端域名和 R2/S3 图片域名
  4. [ ] 本地验证：`curl -I http://localhost:4000/health` 响应头包含 `content-security-policy`、`x-frame-options`、`x-content-type-options`

---

### P1-4. 添加 Graceful Shutdown 处理

- **影响**: Fly.io 滚动部署时旧容器直接杀死，正在处理的请求中断，DB 连接泄漏
- **文件**: `apps/api/src/index.ts`
- **改动量**: ~15 行
- **子任务拆分**:
  1. [ ] 安装 `close-with-grace`
  2. [ ] 在 `app.listen()` 后监听 `SIGTERM` / `SIGINT`
  3. [ ] 收到信号后：
     - 停止接受新连接
     - 等待现有请求完成（超时 5~10 秒）
     - 关闭数据库连接和 Redis 连接
     - 退出进程
  4. [ ] 本地验证：启动后 `kill <pid>`，日志显示 graceful close 过程，无报错

---

### P1-5. 拆分健康检查端点（Liveness + Readiness）

- **影响**: Fly.io 无法区分"进程活着"和"可以接收流量"，可能在迁移未完成时就切流量
- **文件**: `apps/api/src/routes/health.routes.ts`
- **改动量**: ~20 行
- **子任务拆分**:
  1. [ ] `GET /health/live` — 始终返回 200（只要进程在跑）
  2. [ ] `GET /health/ready` — 检查：
     - DB 可执行 `SELECT 1`
     - Redis 可 `PING`（如配置了 Redis）
  3. [ ] 保留原 `/health` 做兼容，或重定向到 `/health/ready`
  4. [ ] 更新 `fly.toml` 如有 healthcheck 配置则指向 `/health/ready`
  5. [ ] 更新 `docker-compose.yml` 中的 healthcheck URL

---

## Phase 3 — 部署闭环（上线前必须完成，约 0.5 天）

> 没有这些，前端上不了线，部署流程不可靠。

### P1-6. 前端 Web 生产部署方案

- **影响**: 目前只有 API 有 `fly.toml`，Next.js 前端没有生产部署配置
- **文件**: 新增（根据方案不同）
- **改动量**: 视方案而定
- **子任务拆分**:
  1. [ ] **决策**：选择部署平台
     - 方案 A：Vercel（推荐，Next.js 原生支持）
     - 方案 B：Fly.io（已有经验，但需额外配置）
     - 方案 C：Docker 自建 + Nginx 反代
  2. [ ] **方案 A（Vercel）**：
     - 添加 `vercel.json`（如需要自定义路由）
     - 在 Vercel Dashboard 配置环境变量：`NEXT_PUBLIC_API_URL`、`NEXT_PUBLIC_USE_API` 等
     - 配置 `NEXT_PUBLIC_SITE_URL` 为生产域名
     - 验证构建成功，首页能访问
  3. [ ] **方案 B（Fly.io）**：
     - 新增 `apps/web/fly.toml`
     - 确保 `Dockerfile` 或 Vercel-like 构建流程可用
     - 验证部署
  4. [ ] **统一域名**：确保前端域名在 API 的 `CORS_ORIGIN` 允许列表中

---

### P1-7. 添加 GitHub Actions CI/CD 流水线

- **影响**: 手动部署易出错，没有自动化测试拦截，无法快速回滚
- **文件**: 新建 `.github/workflows/ci.yml`
- **改动量**: ~60 行
- **子任务拆分**:
  1. [ ] 创建 `.github/workflows/ci.yml`
  2. [ ] Stage — Install：pnpm install --frozen-lockfile
  3. [ ] Stage — Lint：`pnpm lint`（如有）
  4. [ ] Stage — Typecheck：`pnpm typecheck`（全仓库）
  5. [ ] Stage — Test：`pnpm test:api`
  6. [ ] Stage — Build API Docker：`docker build -f apps/api/Dockerfile .`
  7. [ ] Stage — Build Web：`pnpm --filter @yezz/web build`
  8. [ ] 配置分支保护：`main` 分支必须通过 CI 才能合并
  9. [ ] （可选）自动部署：CI 通过后自动 `fly deploy`

---

## 排期总览（建议顺序）

| 天数 | 任务 | 优先级 |
|------|------|--------|
| **Day 1 上午** | P0-1 `fly.toml` 修复 | P0 |
| | P0-2 关闭 `ignoreBuildErrors` + 修复类型报错 | P0 |
| | P0-3 `trustProxy` 配置 | P0 |
| **Day 1 下午** | P1-1 API Dockerfile 多阶段构建 | P1 |
| | P1-2 环境变量校验 | P1 |
| | P1-3 Helmet 安全头 | P1 |
| | P1-4 Graceful Shutdown | P1 |
| **Day 2 上午** | P1-5 健康检查拆分 | P1 |
| | P1-6 前端部署方案落地 | P1 |
| **Day 2 下午** | P1-7 GitHub Actions CI/CD | P1 |
| | 全链路验证（本地 build → docker up → e2e 走通） | — |

---

## 验收 Checklist（全部打勾 = 可以上线）

- [ ] `fly.toml` 的 `release_command` 是 `migrate` 而非 `migrate:fix`
- [ ] `pnpm typecheck` 全仓库零报错
- [ ] API Docker 镜像构建成功，只包含生产依赖
- [ ] Fly.io 部署后 `request.ip` 显示真实公网 IP
- [ ] `/health/ready` 在数据库未就绪时返回 503
- [ ] API 响应头包含 `content-security-policy` 和 `x-frame-options`
- [ ] `kill` API 进程后 graceful shutdown，无未处理异常
- [ ] 缺少环境变量时 API 启动即退出，给出明确错误
- [ ] 前端生产部署成功，首页可访问
- [ ] CI 流水线全绿（lint + typecheck + test + build）
- [ ] 手动走一遍核心流程：访问首页 → 浏览项目 → 提交预订 → 登录后台 → 查看预订

---

## 附：不改 P0/P1 直接上线的最坏情况

| 风险场景 | 后果 |
|----------|------|
| `migrate:fix` 在生产执行 | **数据库被清空**，所有订单、用户、项目数据丢失 |
| `ignoreBuildErrors` 隐藏了关键类型错误 | 生产环境某些页面直接 500 崩溃 |
| `trustProxy` 未配置 | 恶意用户可以用脚本暴力破解登录（限流对所有人共享一个 IP） |
| 没有 CI/CD | 某次手动部署忘改环境变量，服务起不来，紧急回滚困难 |
| 没有 Graceful Shutdown | 每次部署都有用户在提交订单时被打断，数据不一致 |

---

*文档生成日期: 2026-06-16*
