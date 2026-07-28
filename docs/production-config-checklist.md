# YezYY 生产环境上线配置清单

> 本文档基于代码库完整扫描生成，涵盖所有需要配置的环境变量、外部服务、安全设置和部署步骤。
> 生成日期：2026-06-29

---

## 一、必须配置项（不配置无法上线）

### 1. 数据库 `DATABASE_URL`

| 属性 | 说明 |
|------|------|
| **用途** | PostgreSQL 数据库连接 |
| **是否必须** | ✅ 是，缺失会直接导致应用崩溃 |
| **代码位置** | `apps/api/src/plugins/db.ts:14` |
| **示例值** | `postgresql://USER:PASSWORD@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require` |

**配置建议：**
- 开发使用本地 Docker（`docker-compose.yml` 已配置）
- 生产推荐使用 [Neon](https://neon.tech)、[Supabase](https://supabase.com) 或 AWS RDS
- 连接字符串中建议开启 SSL (`sslmode=require`)

---

### 2. JWT 密钥 `JWT_SECRET`

| 属性 | 说明 |
|------|------|
| **用途** | 管理员登录 Token 签名 |
| **是否必须** | ✅ 是，缺失会直接导致应用崩溃 |
| **代码位置** | `apps/api/src/plugins/auth.ts:25` |
| **默认值** | `dev-secret-key-change-in-production` ⚠️ |

**⚠️ 警告：** `.env.local` 中的默认值是开发用的弱密钥，**上线前必须更换**为强随机字符串。

**生成强密钥的方法：**
```bash
# macOS / Linux
openssl rand -base64 32

# 或 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

### 3. 前端 API 连接

| 变量 | 用途 | 是否必须 | 示例值 |
|------|------|---------|--------|
| `NEXT_PUBLIC_API_URL` | 前端调用 API 的基础地址 | ✅ 是 | `https://api.yezyy.com` |
| `NEXT_PUBLIC_USE_API` | 开关：是否使用真实 API（而非假数据） | ✅ 是 | `true` |

**⚠️ 警告：** 如果 `NEXT_PUBLIC_USE_API` 不为 `true`，生产环境将只显示假数据，用户无法看到真实内容。

> 代码位置：`apps/web/lib/api/config.ts`
> 注意：`NEXT_PUBLIC_` 前缀的变量在**构建时**就嵌入代码，修改后必须重新构建部署。

---

### 4. 跨域配置 `CORS_ORIGIN`

| 属性 | 说明 |
|------|------|
| **用途** | 允许访问 API 的前端域名 |
| **是否必须** | ✅ 是 |
| **代码位置** | `apps/api/src/app.ts:13` |
| **当前默认值** | `http://localhost:3000` |
| **示例值** | `https://yezyy.com` 或 `https://app1.com,https://app2.com` |

**说明：**
- 支持多个域名，用逗号分隔
- 生产环境 (`NODE_ENV=production`) 只会允许配置的域名，不再自动允许 localhost
- 如果前端和 API 部署在不同域名，必须正确配置此项

---

### 5. 运行环境 `NODE_ENV`

| 属性 | 说明 |
|------|------|
| **用途** | 标识当前运行环境 |
| **是否必须** | ✅ 是 |
| **生产值** | `production` |

**影响范围：**
- CORS 行为（生产环境只接受配置的域名）
- Cookie 安全标志（生产环境开启 `secure`）
- Swagger API 文档（生产环境自动关闭）
- 前端警告提示

### 6. Web/API 内部请求签名

| 变量 | 部署位置 | 用途 |
|------|----------|------|
| `WEB_API_SHARED_SECRET` | Fly API + Vercel Web | 当前 HMAC 密钥，至少 32 个字符 |
| `WEB_API_SHARED_SECRET_PREVIOUS` | 仅 Fly API，可选 | 轮换期间临时接受上一把密钥 |
| `RATE_LIMIT_HASH_SECRET` | 仅 Fly API | 请求主体 HMAC 密钥，独立随机生成且至少 32 字节 |
| `INTERNAL_REQUEST_ENFORCEMENT` | 仅 Fly API | 首次上线用 `log`，验证完成后改为 `require` |
| `API_URL` | 仅 Vercel Web | BFF 访问 Fly API 的服务端地址 |

这些变量全部是**服务端密钥**。不得使用 `NEXT_PUBLIC_` 前缀，也不得写入
代码、日志或客户端错误信息。当前密钥和上一把密钥必须不同；任一已配置
密钥少于 32 个字符都会使服务拒绝启动或拒绝代理请求。
`RATE_LIMIT_HASH_SECRET` 必须与 Web/API 签名密钥不同，只配置在 Fly API，
且不得记录到日志。可使用 `openssl rand -base64 32` 独立生成。

**首次上线顺序：**

1. Fly 设置当前密钥并使用 `INTERNAL_REQUEST_ENFORCEMENT=log`。
2. Vercel 设置同一把当前密钥并部署 BFF。
3. 验证后台登录、购物车、预约、上传、CSRF 拒绝和不同访客 IP。
4. Fly 改为 `INTERNAL_REQUEST_ENFORCEMENT=require`。

**无中断轮换顺序：**

1. 生成新的强随机密钥。Fly 设置 `WEB_API_SHARED_SECRET=新密钥`，
   `WEB_API_SHARED_SECRET_PREVIOUS=旧密钥`，Vercel 此时仍使用旧密钥。
2. 部署并验证 Fly 同时接受新旧签名，但不会记录任何密钥或签名。
3. Vercel 将 `WEB_API_SHARED_SECRET` 切换为新密钥并部署。
4. 等待至少五分钟（旧签名的最长有效期），确认所有 Vercel 实例均已更新。
5. 从 Fly 删除 `WEB_API_SHARED_SECRET_PREVIOUS`，只保留新密钥。

不要在 Vercel 配置 `WEB_API_SHARED_SECRET_PREVIOUS`；BFF 始终只用当前密钥
签名。不要把新旧密钥设置为相同值。

---

## 二、强烈建议配置（影响核心功能）

### 7. 文件存储（图片上传）

如果网站需要上传图片（项目展示图、Gallery、微信二维码等），必须配置 S3 兼容存储。

| 变量 | 用途 | 示例值（Cloudflare R2） |
|------|------|------------------------|
| `S3_ENDPOINT` | 存储服务端点 | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | 区域 | `auto` |
| `S3_ACCESS_KEY` | 访问密钥 | `xxxx` |
| `S3_SECRET_KEY` | 秘密密钥 | `xxxx` |
| `S3_BUCKET` | 存储桶名称 | `yezz-media` |
| `S3_PUBLIC_URL` | 图片公开访问地址 | `https://media.yezyy.com` 或 `https://pub-xxx.r2.dev` |

> 代码位置：`apps/api/src/lib/storage.ts`

**不配置的后果：** 图片上传功能会报错 "S3 storage is not configured"

**推荐方案：** [Cloudflare R2](https://developers.cloudflare.com/r2/)（10GB 免费，无出站流量费）

---

### 8. 邮件通知服务（Resend）

| 变量 | 用途 | 是否必须 |
|------|------|---------|
| `RESEND_API_KEY` | Resend API 密钥 | ✅ 生产环境必须 |
| `OWNER_EMAIL` | 接收订单/预约通知的商家邮箱 | ✅ 生产环境必须 |
| `EMAIL_FROM` | Resend 已验证的交易邮件发件人 | ✅ 生产环境必须 |
| `EMAIL_REPLY_TO` | 顾客回复邮件的地址 | ✅ 生产环境必须，使用 `congdongdong03@gmail.com` |

> 代码位置：`apps/api/src/lib/email.ts`

**不配置的后果：**
- 用户下单/预约后，商家**不会收到邮件通知**
- 但后台的"未读消息计数"仍然有效
- 用户端也**收不到确认邮件**

**计划发件人地址（仅在 Resend 完成域名验证后配置）：**
```
YezYY <bookings@yezyy.com>
```
> API 在生产环境启动时会检查 `EMAIL_FROM`：缺少时将拒绝启动，避免从旧域名或未配置的地址发送邮件。`EMAIL_REPLY_TO` 可以配置为 `congdongdong03@gmail.com`，它是顾客回复地址，不代表 Gmail 已被验证为 Resend 的交易邮件发件人。

**上线前填写：**
```bash
RESEND_API_KEY=re_...
OWNER_EMAIL=congdongdong03@gmail.com
EMAIL_FROM="YezYY <bookings@yezyy.com>"
EMAIL_REPLY_TO=congdongdong03@gmail.com
```

**邮件 DNS 建议：** 如果使用 `yezyy.com` 发邮件，建议在域名 DNS 中添加：
- SPF 记录
- DKIM 记录
- DMARC 记录

否则邮件容易进垃圾箱。

---

### 9. 网站域名 `NEXT_PUBLIC_SITE_URL`

| 属性 | 说明 |
|------|------|
| **用途** | 网站正式域名，用于生成 sitemap、robots.txt、SEO 元数据 |
| **是否必须** | 建议配置 |
| **代码位置** | `apps/web/lib/site/url.ts` |
| **示例值** | `https://yezyy.com` |

**不配置的后果：**
- sitemap.xml 中的 URL 会是 `http://localhost:3000`
- 搜索引擎可能无法正确索引网站

---

### 10. Redis `REDIS_URL`

| 属性 | 说明 |
|------|------|
| **用途** | 数据缓存 + 登录频率限制 + 购物车 Session |
| **是否必须** | 否（可选） |
| **代码位置** | `apps/api/src/plugins/redis.ts` |
| **示例值** | `redis://localhost:6379` 或 `rediss://xxx.upstash.io:6379` |

**不配置的后果：**
- 没有缓存，每次请求都查数据库（性能稍差）
- 登录频率限制失效（理论上可无限次尝试密码）
- 购物车 Session 使用内存存储（单实例没问题，多实例会丢失）

---

## 三、可选配置项

| 变量 | 用途 | 代码位置 |
|------|------|---------|
| `NEXT_PUBLIC_GA_ID` | Google Analytics 4 追踪 ID | `apps/web/lib/analytics/gtag.ts` |
| `STORE_TIMEZONE` | 邮件中日期显示的时区 | `apps/api/src/lib/email.ts` |
| `JWT_EXPIRES_IN` | 登录 Token 过期时间 | `apps/api/src/plugins/auth.ts` |
| `PORT` | API 服务端口 | `apps/api/src/index.ts` |
| `ENABLE_SWAGGER` | 是否启用 API 文档 | `apps/api/src/plugins/swagger.ts` |

**默认值参考：**
```bash
STORE_TIMEZONE=Australia/Melbourne
JWT_EXPIRES_IN=24h
PORT=4000
```

---

## 四、部署前必须执行的操作

### 步骤 1：运行数据库迁移

创建所有数据表、索引和枚举类型：

```bash
pnpm db:migrate
```

> 生产环境推荐在部署前手动执行，Fly.io 也配置了 `release_command` 自动运行。

---

### 步骤 2：运行安全的生产初始化

生产初始化只会在缺失时创建真实的 YezYY 网站设置和第一个管理员。它不会删除数据，也不会插入示例分类、项目、派对或 Gallery 内容。

```bash
# 必须输入精确保护口令；首次创建管理员时还要提供真实账号和强密码
export ALLOW_PRODUCTION_BOOTSTRAP=YezYY
export ADMIN_EMAIL=congdongdong03@gmail.com
export ADMIN_PASSWORD='使用密码管理器生成的至少12位强密码'

# 执行幂等生产初始化
pnpm --filter @yezz/db bootstrap:production
```

**生产初始化会创建：**
- 1 个管理员账号（仅数据库里还没有管理员时）
- 1 行真实 YezYY 网站设置（仅设置不存在时）
- 0 个示例分类、项目、派对或 Gallery 内容

---

### 步骤 3：登录后台修改网站设置

生产初始化会写入当前已确认的门店信息。登录后台后仍应逐项核对：

| 设置项 | 说明 |
|--------|------|
| 店名 | 网站标题显示的名称 |
| 地址 | 实体店地址 |
| 营业时间 | 如"周一至周日 10:00-22:00" |
| 电话 | 客服电话 |
| 邮箱 | 联系邮箱 |
| 微信号 | 客服微信 |
| 微信二维码 | 上传到 S3 后的图片 URL |
| 首页大图 | Hero 区域背景图 URL |
| Instagram | 社交链接 |
| 小红书 | 社交链接 |
| Google Maps 链接 | 地图导航链接 |
| SEO 标题 | 搜索引擎结果页显示的标题 |
| SEO 描述 | 搜索引擎结果页显示的描述 |

**后台地址：** `https://你的域名/admin`

---

### 步骤 4：验证环境变量

确保以下变量在构建前已设置：

```bash
# API 侧
DATABASE_URL=...
JWT_SECRET=...
CORS_ORIGIN=https://你的域名
NODE_ENV=production
INTERNAL_REQUEST_ENFORCEMENT=require
WEB_API_SHARED_SECRET=... # 至少 32 个字符；与 Vercel 当前值一致
RATE_LIMIT_HASH_SECRET=... # 独立生成，至少 32 字节；仅 Fly API
# WEB_API_SHARED_SECRET_PREVIOUS=... # 仅轮换期间在 Fly 配置
S3_ENDPOINT=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=...
S3_PUBLIC_URL=...
RESEND_API_KEY=...
OWNER_EMAIL=...
EMAIL_FROM="YezYY <bookings@yezyy.com>"
EMAIL_REPLY_TO=congdongdong03@gmail.com
STORE_TIMEZONE=Australia/Melbourne
EMAIL_OUTBOX_WORKER_ENABLED=false
REQUEST_FLOW_EXPERIENCE_ENABLED=false
REQUEST_FLOW_PRODUCT_ENABLED=false
REQUEST_FLOW_PARTY_ENABLED=false

# Web 侧（构建时注入）
NEXT_PUBLIC_API_URL=https://api.你的域名
NEXT_PUBLIC_USE_API=true
NEXT_PUBLIC_SITE_URL=https://你的域名
API_URL=https://api.你的域名
WEB_API_SHARED_SECRET=... # 服务端变量，不得添加 NEXT_PUBLIC_ 前缀
```

---

## 五、代码中写死的值（建议改为可配置）

以下值目前直接写在代码里，如需修改必须改代码后重新部署：

| 值 | 位置 | 建议 |
|---|------|------|
| 开发环境邮件发件人 fallback | `apps/api/src/lib/email.ts` | 生产环境必须配置已验证的 `EMAIL_FROM` |
| `Australia/Sydney` | `apps/api/src/lib/email.ts` | 可通过 `STORE_TIMEZONE` 覆盖；生产建议 `Australia/Melbourne` |
| `admin@yezz.local` | `packages/db/src/seed-dev-demo.ts` | 仅开发演示种子使用；生产初始化会拒绝 |
| `changeme` | `packages/db/src/seed-dev-demo.ts` | 仅开发演示种子使用；生产初始化会拒绝 |
| `YezYY` | `apps/web/lib/site/business.ts` | 作为公开 fallback 名称 |

---

## 六、安全加固建议

### 高优先级

| 项目 | 说明 | 代码位置 |
|------|------|---------|
| **验证 BFF 客户身份** | 浏览器写请求只使用签名后的 Vercel 客户 IP；Fly 不信任普通 `X-Forwarded-For` | `apps/web/lib/internal-api/signature.ts`、`apps/api/src/lib/internal-request.ts` |
| **添加 CSP 安全头** | 当前未配置内容安全策略，建议添加 `Content-Security-Policy`、`X-Frame-Options` 等 | `apps/web/next.config.ts` |

### 中优先级

| 项目 | 说明 | 代码位置 |
|------|------|---------|
| **API Dockerfile 非 root 运行** | 当前 API 容器以 root 运行，建议添加 `USER` 指令 | `apps/api/Dockerfile` |
| **公开接口频率限制** | `/projects`、`/gallery`、`/cart-orders` 等接口目前无频率限制 | 各 routes 文件 |
| **请求体验证** | API 目前缺少运行时请求体验证（如 Zod），建议补上防止畸形数据 | 各 routes 文件 |
| **JWT Token 刷新/吊销** | 当前 Token 24 小时过期，无刷新机制；也无黑名单机制 | `apps/api/src/plugins/auth.ts` |

---

## 七、部署平台配置（Fly.io）

如果继续使用 Fly.io 部署，相关配置文件：

| 文件 | 用途 |
|------|------|
| `fly.toml` | Fly.io 应用配置（端口、健康检查、发布命令） |
| `apps/api/Dockerfile` | API 服务容器镜像 |
| `apps/web/Dockerfile` | Web 前端容器镜像 |

**Fly.io 密钥设置命令：**
```bash
# API 密钥
fly secrets set DATABASE_URL="..." JWT_SECRET="..." CORS_ORIGIN="..."
fly secrets set WEB_API_SHARED_SECRET="..." RATE_LIMIT_HASH_SECRET="..." INTERNAL_REQUEST_ENFORCEMENT="log"
fly secrets set S3_ENDPOINT="..." S3_ACCESS_KEY="..." S3_SECRET_KEY="..."
fly secrets set RESEND_API_KEY="..." OWNER_EMAIL="..." EMAIL_FROM="YezYY <bookings@yezyy.com>" EMAIL_REPLY_TO="congdongdong03@gmail.com" STORE_TIMEZONE="Australia/Melbourne"

# Web 构建参数（如用 Docker 部署）
fly secrets set NEXT_PUBLIC_API_URL="..." NEXT_PUBLIC_USE_API="true"
```

---

## 八、请求闭环分阶段上线（Fly + Vercel）

所有公开请求能力在已提交的生产默认配置中均为关闭状态。以下步骤是人工
发布记录模板，不授权实际生产变更。没有业务负责人明确授权时，不得启用
能力开关，也不得提交真实生产预约。

### 1. 固定发布基线和恢复点

- [ ] 记录当前应用提交：`<CURRENT_APP_COMMIT>`
- [ ] 记录待发布 API 提交：`<FLY_RELEASE_COMMIT>`
- [ ] 记录待发布 Web 提交：`<VERCEL_RELEASE_COMMIT>`
- [ ] 在 Neon 创建并记录恢复点：`<NEON_RESTORE_POINT_ID>`
- [ ] 记录操作者和 UTC 时间：`<OPERATOR> / <UTC_TIMESTAMP>`

### 2. 运行迁移前不变量查询

在只读会话中执行，四项结果都必须为 `0`：

```sql
select count(*) as invalid_slots
from time_slots
where capacity < 1
   or booked_count < 0
   or booked_count > capacity
   or start_time !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
   or end_time !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
   or start_time >= end_time;

select count(*) as duplicate_effective_slots
from (
  select date, start_time, end_time,
         coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid)
  from time_slots
  group by date, start_time, end_time,
           coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid)
  having count(*) > 1
) duplicates;

select count(*) as invalid_request_capacity_links
from (
  select b.id
  from bookings b
  join time_slots t on t.id = b.time_slot_id
  where b.status <> 'cancelled'
    and coalesce(b.number_of_people, 1) > t.capacity
  union all
  select o.id
  from cart_orders o
  join time_slots t on t.id = o.time_slot_id
  where o.status <> 'cancelled'
    and coalesce(o.number_of_people, 1) > t.capacity
) invalid;

with active_capacity as (
  select b.time_slot_id,
         coalesce(b.number_of_people, 1)::bigint as people
  from bookings b
  where b.status <> 'cancelled'
    and b.time_slot_id is not null
  union all
  select o.time_slot_id,
         coalesce(o.number_of_people, 1)::bigint as people
  from cart_orders o
  where o.status <> 'cancelled'
    and o.time_slot_id is not null
),
expected_capacity as (
  select time_slot_id, sum(people)::bigint as booked_count
  from active_capacity
  group by time_slot_id
)
select count(*) as capacity_counter_mismatches
from time_slots t
left join expected_capacity e on e.time_slot_id = t.id
where t.booked_count::bigint <> coalesce(e.booked_count, 0);
```

保存查询输出到发布工单；任何非零结果都暂停发布。

### 3. 部署 Fly 迁移和 API，能力保持关闭

先由获授权人员配置 Fly 服务端变量，再发布 API：

```bash
fly secrets set \
  INTERNAL_REQUEST_ENFORCEMENT=log \
  EMAIL_OUTBOX_WORKER_ENABLED=false \
  REQUEST_FLOW_EXPERIENCE_ENABLED=false \
  REQUEST_FLOW_PRODUCT_ENABLED=false \
  REQUEST_FLOW_PARTY_ENABLED=false

fly deploy --image <FLY_RELEASE_IMAGE>
```

确认 release command 完成迁移、健康检查通过，并记录部署 ID。此阶段 API
即使被直接调用也必须返回 `REQUEST_FLOW_DISABLED`。

### 4. 部署带签名 BFF 的 Vercel Web

由获授权人员在 Fly 和 Vercel 配置同一个
`WEB_API_SHARED_SECRET`，Vercel 同时配置 `API_URL`。部署并记录 Vercel
Deployment ID。密钥不得出现在命令输出、工单正文或客户端变量中。

### 5. 验证 Cookie、CSRF 和访客身份

- [ ] 后台登录仅设置第一方、Host-only、HttpOnly、Secure、SameSite=Lax Cookie
- [ ] 跨站 POST/PATCH 返回拒绝，且 Fly 未收到业务写入
- [ ] 伪造 `X-Forwarded-For` 不改变限流主体
- [ ] 能力关闭时，两个经 Vercel 验证的访客 IP 都收到
      `REQUEST_FLOW_DISABLED`，且能力关闭时不得产生 `request_rate_limits`
      记录；独立限流桶只在获授权的能力烟测中验证
- [ ] BFF 转发的请求 ID、时间戳、正文摘要和签名通过 Fly 日志验证

只使用无业务写入的验证请求；此阶段不得创建生产预约。

### 6. 将 Fly 签名模式切换为强制

日志验证无误后：

```bash
fly secrets set INTERNAL_REQUEST_ENFORCEMENT=require
```

确认无签名、过期签名、正文被修改或客户 IP 缺失的请求均失败。

### 7. 验证邮件 Outbox 后再启动 Worker

先确认 Resend 域名、`EMAIL_FROM`、`EMAIL_REPLY_TO`、`OWNER_EMAIL` 和失败告警，
再由获授权人员执行：

```bash
fly secrets set EMAIL_OUTBOX_WORKER_ENABLED=true
```

观察一条获授权测试邮件的 `pending → processing → sent` 记录；失败必须在中文
后台可见且可人工重试。若 Resend 域名或发件人尚未验证，保持 Worker 关闭并
暂停发布。

### 8. 单独启用体验请求

```bash
fly secrets set REQUEST_FLOW_EXPERIENCE_ENABLED=true
```

重新部署/刷新 Web 设置后，仅在负责人明确授权下创建一条受控体验请求，
核对同一 ID 的项目、档期、名额、状态事件和邮件，再决定是否保留开启。

### 9. 单独启用产品请求

```bash
fly secrets set REQUEST_FLOW_PRODUCT_ENABLED=true
```

执行获授权的产品请求烟测，核对服务端商品/款式快照、取消幂等性、名额只释放
一次以及客户邮件。体验开关的状态不得因本步骤意外改变。

### 10. 单独启用派对请求

```bash
fly secrets set REQUEST_FLOW_PARTY_ENABLED=true
```

执行获授权的派对请求烟测，核对服务端套餐、人数范围、档期、状态事件和邮件。
三个能力必须逐个审批，禁止一次性全开。

### 11. 记录结果和可恢复回滚命令

- [ ] Fly 部署 ID / 提交：`<FLY_DEPLOYMENT_ID> / <FLY_RELEASE_COMMIT>`
- [ ] Vercel 部署 ID / 提交：`<VERCEL_DEPLOYMENT_ID> / <VERCEL_RELEASE_COMMIT>`
- [ ] 三个烟测请求 ID（如获授权）：`<EXPERIENCE_ID> / <PRODUCT_ID> / <PARTY_ID>`
- [ ] 完成时间和审批人：`<UTC_TIMESTAMP> / <APPROVER>`

应用回滚不执行破坏性 down migration。先用当前具备能力开关的版本立即关闭
三个请求能力和邮件 Worker。回滚目标必须仍包含能力开关、服务端创建拒绝和
Web 联系方式回退；禁止回滚到任何开关上线前的 API 镜像或 Web 部署，因为
旧 API 会忽略关闭变量，旧 Web 会重新显示提交入口。

```bash
fly secrets set \
  REQUEST_FLOW_EXPERIENCE_ENABLED=false \
  REQUEST_FLOW_PRODUCT_ENABLED=false \
  REQUEST_FLOW_PARTY_ENABLED=false \
  EMAIL_OUTBOX_WORKER_ENABLED=false

fly deploy --image <LAST_KNOWN_GOOD_GATE_AWARE_FLY_IMAGE>
vercel rollback <LAST_KNOWN_GOOD_GATE_AWARE_VERCEL_DEPLOYMENT_URL>
```

如果不存在更早的 gate-aware 版本，则保持当前版本，仅关闭变量并修复前滚；
不得选择 pre-gate 版本。保留新增表、请求、状态事件和邮件记录供审计。只有
在明确的事故恢复授权下，才可使用记录的 Neon 恢复点。

### 外部授权暂停点

执行以下任一动作前必须停止并取得负责人明确授权：添加或轮换 Fly/Vercel
签名密钥、使用 Neon 恢复点或生产迁移、添加 Resend DNS 或更换已验证发件人、
部署 Fly/Vercel、启动邮件 Worker、启用任一请求能力、创建受控生产请求。

---

## 九、上线前最终检查清单

- [ ] `DATABASE_URL` 已设置为生产数据库
- [ ] `JWT_SECRET` 已更换为强随机字符串（不是 `dev-secret-key-change-in-production`）
- [ ] `NEXT_PUBLIC_API_URL` 指向生产 API 地址
- [ ] `NEXT_PUBLIC_USE_API=true`
- [ ] `CORS_ORIGIN` 设置为前端生产域名
- [ ] `NODE_ENV=production`
- [ ] Fly 与 Vercel 的 `WEB_API_SHARED_SECRET` 当前值一致且至少 32 个字符
- [ ] `WEB_API_SHARED_SECRET` 未使用 `NEXT_PUBLIC_` 前缀
- [ ] Fly 已设置独立强随机的 `RATE_LIMIT_HASH_SECRET`，且未写入日志或 Vercel
- [ ] 首次签名流量验证后，Fly 已设置 `INTERNAL_REQUEST_ENFORCEMENT=require`
- [ ] 非轮换期间，Fly 未保留 `WEB_API_SHARED_SECRET_PREVIOUS`
- [ ] S3 存储已配置（如需图片上传功能）
- [ ] `RESEND_API_KEY`、`OWNER_EMAIL`、`EMAIL_FROM` 和 `EMAIL_REPLY_TO` 已配置
- [ ] 三个 `REQUEST_FLOW_*_ENABLED` 在初始生产部署中均为 `false`
- [ ] `EMAIL_OUTBOX_WORKER_ENABLED` 在邮件服务验证前保持 `false`
- [ ] 运行了 `pnpm db:migrate`
- [ ] 运行了 `pnpm --filter @yezz/db bootstrap:production`
- [ ] 生产环境没有运行 `seed:dev-demo` 或设置 `FORCE_SEED`
- [ ] 登录后台 `/admin` 核对了所有网站设置
- [ ] `.env.local` 文件已加入 `.gitignore`，未提交到代码仓库
- [ ] 生产环境密钥通过部署平台（Fly.io / Vercel）注入，不在代码中
- [ ] （可选）配置了 Redis
- [ ] （可选）配置了 Google Analytics

---

## 附录：完整环境变量模板

```bash
# ============================================
# YezYY 生产环境配置模板
# ============================================

# -------- 核心必须 --------
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
JWT_SECRET=xxxx                            # openssl rand -base64 32
JWT_EXPIRES_IN=24h
CORS_ORIGIN=https://yezyy.com
NODE_ENV=production
PORT=4000
INTERNAL_REQUEST_ENFORCEMENT=require
WEB_API_SHARED_SECRET=xxxx                # openssl rand -base64 32
RATE_LIMIT_HASH_SECRET=xxxx               # 独立运行 openssl rand -base64 32
# WEB_API_SHARED_SECRET_PREVIOUS=xxxx     # 仅 Fly 轮换窗口使用

# -------- 前端必须（构建时） --------
NEXT_PUBLIC_API_URL=https://api.yezyy.com
NEXT_PUBLIC_USE_API=true
NEXT_PUBLIC_SITE_URL=https://yezyy.com
API_URL=https://api.yezyy.com
WEB_API_SHARED_SECRET=xxxx                # Vercel 服务端变量

# -------- 文件存储（建议） --------
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=xxx
S3_BUCKET=yezz-media
S3_PUBLIC_URL=https://media.yezyy.com

# -------- 邮件服务（生产必须） --------
RESEND_API_KEY=re_xxx
OWNER_EMAIL=congdongdong03@gmail.com
EMAIL_FROM="YezYY <bookings@yezyy.com>"
EMAIL_REPLY_TO=congdongdong03@gmail.com
STORE_TIMEZONE=Australia/Melbourne

# -------- Redis（可选） --------
REDIS_URL=redis://localhost:6379

# -------- 分析（可选） --------
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# -------- 安全生产初始化（仅首次部署；已有管理员时可不再提供账号密码） --------
ALLOW_PRODUCTION_BOOTSTRAP=YezYY
ADMIN_EMAIL=congdongdong03@gmail.com
ADMIN_PASSWORD=使用密码管理器生成的至少12位强密码
```

---

> 💡 提示：本文档可通过重新扫描代码库更新。如有功能变更，建议重新生成。
