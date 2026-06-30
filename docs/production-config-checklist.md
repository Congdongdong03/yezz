# YEZZ 生产环境上线配置清单

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
| `NEXT_PUBLIC_API_URL` | 前端调用 API 的基础地址 | ✅ 是 | `https://api.yezz.studio` |
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
| **示例值** | `https://yezz.studio` 或 `https://app1.com,https://app2.com` |

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

---

## 二、强烈建议配置（影响核心功能）

### 6. 文件存储（图片上传）

如果网站需要上传图片（项目展示图、Gallery、微信二维码等），必须配置 S3 兼容存储。

| 变量 | 用途 | 示例值（Cloudflare R2） |
|------|------|------------------------|
| `S3_ENDPOINT` | 存储服务端点 | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | 区域 | `auto` |
| `S3_ACCESS_KEY` | 访问密钥 | `xxxx` |
| `S3_SECRET_KEY` | 秘密密钥 | `xxxx` |
| `S3_BUCKET` | 存储桶名称 | `yezz-media` |
| `S3_PUBLIC_URL` | 图片公开访问地址 | `https://media.yezz.studio` 或 `https://pub-xxx.r2.dev` |

> 代码位置：`apps/api/src/lib/storage.ts`

**不配置的后果：** 图片上传功能会报错 "S3 storage is not configured"

**推荐方案：** [Cloudflare R2](https://developers.cloudflare.com/r2/)（10GB 免费，无出站流量费）

---

### 7. 邮件通知服务（Resend）

| 变量 | 用途 | 是否必须 |
|------|------|---------|
| `RESEND_API_KEY` | Resend API 密钥 | 建议配置 |
| `OWNER_EMAIL` | 接收订单/预约通知的商家邮箱 | 建议配置 |

> 代码位置：`apps/api/src/lib/email.ts`

**不配置的后果：**
- 用户下单/预约后，商家**不会收到邮件通知**
- 但后台的"未读消息计数"仍然有效
- 用户端也**收不到确认邮件**

**发件人地址（当前写死）：**
```
YEZZ <bookings@yezz.studio>
```
> 如果要修改，需编辑 `apps/api/src/lib/email.ts:12`

**邮件 DNS 建议：** 如果使用 `yezz.studio` 发邮件，建议在域名 DNS 中添加：
- SPF 记录
- DKIM 记录
- DMARC 记录

否则邮件容易进垃圾箱。

---

### 8. 网站域名 `NEXT_PUBLIC_SITE_URL`

| 属性 | 说明 |
|------|------|
| **用途** | 网站正式域名，用于生成 sitemap、robots.txt、SEO 元数据 |
| **是否必须** | 建议配置 |
| **代码位置** | `apps/web/lib/site/url.ts` |
| **示例值** | `https://yezz.studio` |

**不配置的后果：**
- sitemap.xml 中的 URL 会是 `http://localhost:3000`
- 搜索引擎可能无法正确索引网站

---

### 9. Redis `REDIS_URL`

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
STORE_TIMEZONE=Australia/Sydney    # 建议国内改为 Asia/Shanghai
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

### 步骤 2：运行数据库种子

填充初始数据（分类、示例项目、管理员账号等）：

```bash
# 先设置管理员账号（不要用默认值！）
export ADMIN_EMAIL=your-email@example.com
export ADMIN_PASSWORD=your-very-strong-password

# 执行种子
pnpm db:seed
```

**种子会创建：**
- 5 个项目分类
- 16 个示例 DIY 项目
- 3 个派对套餐
- 9 张 Gallery 图片
- 1 个管理员账号
- 1 行网站设置（全为占位符）

---

### 步骤 3：登录后台修改网站设置

种子数据中的 `site_settings` 全部是占位符，**必须进后台改成真实信息**：

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
S3_ENDPOINT=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=...
S3_PUBLIC_URL=...
RESEND_API_KEY=...
OWNER_EMAIL=...

# Web 侧（构建时注入）
NEXT_PUBLIC_API_URL=https://api.你的域名
NEXT_PUBLIC_USE_API=true
NEXT_PUBLIC_SITE_URL=https://你的域名
```

---

## 五、代码中写死的值（建议改为可配置）

以下值目前直接写在代码里，如需修改必须改代码后重新部署：

| 值 | 位置 | 建议 |
|---|------|------|
| `YEZZ <bookings@yezz.studio>` | `apps/api/src/lib/email.ts:12` | 改为环境变量 `EMAIL_FROM` |
| `Australia/Sydney` | `apps/api/src/lib/email.ts:100` | 改为环境变量 `STORE_TIMEZONE` |
| `admin@yezz.local` | `packages/db/src/seed.ts:234` | 种子时通过 `ADMIN_EMAIL` 覆盖 |
| `changeme` | `packages/db/src/seed.ts:235` | 种子时通过 `ADMIN_PASSWORD` 覆盖 |
| `YEZZ DIY Studio` | `apps/web/lib/site/data.ts:24` | 作为 fallback 名称 |

---

## 六、安全加固建议

### 高优先级

| 项目 | 说明 | 代码位置 |
|------|------|---------|
| **配置 Trust Proxy** | API 在 Fly.io 后面运行，需要信任代理才能获取真实用户 IP，否则频率限制对所有用户共享 | `apps/api/src/app.ts` |
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
fly secrets set S3_ENDPOINT="..." S3_ACCESS_KEY="..." S3_SECRET_KEY="..."
fly secrets set RESEND_API_KEY="..." OWNER_EMAIL="..."

# Web 构建参数（如用 Docker 部署）
fly secrets set NEXT_PUBLIC_API_URL="..." NEXT_PUBLIC_USE_API="true"
```

---

## 八、上线前最终检查清单

- [ ] `DATABASE_URL` 已设置为生产数据库
- [ ] `JWT_SECRET` 已更换为强随机字符串（不是 `dev-secret-key-change-in-production`）
- [ ] `NEXT_PUBLIC_API_URL` 指向生产 API 地址
- [ ] `NEXT_PUBLIC_USE_API=true`
- [ ] `CORS_ORIGIN` 设置为前端生产域名
- [ ] `NODE_ENV=production`
- [ ] S3 存储已配置（如需图片上传功能）
- [ ] `RESEND_API_KEY` 和 `OWNER_EMAIL` 已配置（如需邮件通知）
- [ ] 运行了 `pnpm db:migrate`
- [ ] 运行了 `pnpm db:seed`（并设置了 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD`）
- [ ] 登录后台 `/admin` 更新了所有"网站设置"
- [ ] `.env.local` 文件已加入 `.gitignore`，未提交到代码仓库
- [ ] 生产环境密钥通过部署平台（Fly.io / Vercel）注入，不在代码中
- [ ] （可选）配置了 Redis
- [ ] （可选）配置了 Google Analytics

---

## 附录：完整环境变量模板

```bash
# ============================================
# YEZZ 生产环境配置模板
# ============================================

# -------- 核心必须 --------
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
JWT_SECRET=xxxx                            # openssl rand -base64 32
JWT_EXPIRES_IN=24h
CORS_ORIGIN=https://yezz.studio
NODE_ENV=production
PORT=4000

# -------- 前端必须（构建时） --------
NEXT_PUBLIC_API_URL=https://api.yezz.studio
NEXT_PUBLIC_USE_API=true
NEXT_PUBLIC_SITE_URL=https://yezz.studio

# -------- 文件存储（建议） --------
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=xxx
S3_BUCKET=yezz-media
S3_PUBLIC_URL=https://media.yezz.studio

# -------- 邮件服务（建议） --------
RESEND_API_KEY=re_xxx
OWNER_EMAIL=owner@yezz.studio
STORE_TIMEZONE=Asia/Shanghai

# -------- Redis（可选） --------
REDIS_URL=redis://localhost:6379

# -------- 分析（可选） --------
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# -------- 种子脚本（仅首次部署） --------
ADMIN_EMAIL=admin@yezz.studio
ADMIN_PASSWORD=your-strong-password
```

---

> 💡 提示：本文档可通过重新扫描代码库更新。如有功能变更，建议重新生成。
