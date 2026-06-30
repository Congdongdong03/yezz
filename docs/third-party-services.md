# YEZZ 第三方服务使用清单

> 域名：`https://yezyy.com`  
> 生成日期：2026-06-29  
> 本文档基于完整代码库扫描生成

---

## 一、已经配置好正在用的

以下服务已经接入代码或基础设施，开发环境可直接使用。

| 服务 | 用途 | 状态 | 相关文件 |
|------|------|------|---------|
| **Fly.io** | API 后端部署（`yezz-api` 应用） | ✅ 已配置 | `fly.toml` |
| **GitHub Actions** | CI/CD 自动化测试 | ✅ 已配置 | `.github/workflows/ci.yml` |
| **Docker Hub** | 拉取基础镜像 | ✅ 隐式使用 | `Dockerfile`, `docker-compose.yml` |
| **PostgreSQL (Docker)** | 本地开发数据库 | ✅ 已配置 | `docker-compose.yml` |
| **Redis (Docker)** | 本地缓存 + 频率限制 | ✅ 已配置 | `docker-compose.yml` |
| **MinIO (Docker)** | 本地文件存储（S3 兼容） | ✅ 已配置 | `docker-compose.yml` |
| **Google Fonts** | 网页字体（Inter、Noto Serif SC） | ✅ 已配置 | `apps/web/app/layout.tsx` |
| **Google Maps** | 联系页地图嵌入 | ✅ 已配置 | `apps/web/app/[locale]/contact/page.tsx` |
| **Unsplash** | 允许加载远程示例图片 | ✅ 已配置 | `apps/web/next.config.ts` |
| **Picsum Photos** | 种子数据 / 假数据图片 | ✅ 已配置 | `packages/db/src/seed.ts` |

---

## 二、代码已接入但尚未配置生产环境

以下服务 SDK 已安装、代码已写好，但 `.env.local` 中仍是开发占位符，**需要注册生产账号并填入密钥**。

| 服务 | 用途 | 当前状态 | 需要你做什么 | 相关文件 |
|------|------|---------|-------------|---------|
| **Resend** | 发送交易邮件（订单通知、预约确认、管理员通知） | SDK 已装，代码就绪 | 注册 [resend.com](https://resend.com)，获取 API Key | `apps/api/src/lib/email.ts` |
| **Cloudflare R2** | 生产环境图片/文件存储（S3 兼容） | SDK 已装，配置预留 | 登录 [dash.cloudflare.com](https://dash.cloudflare.com)，创建 R2 Bucket 和 API Token | `apps/api/src/lib/storage.ts` |
| **Google Analytics 4** | 网站流量统计、事件追踪 | 代码已植入所有页面 | 注册 [analytics.google.com](https://analytics.google.com)，获取测量 ID（`G-XXXXXXXXXX`） | `apps/web/components/analytics/GoogleAnalytics.tsx` |

---

## 三、文档中提到但尚未接入的服务（可选）

以下服务在 README、配置文档或 `.env.example` 中被提及为推荐方案，但**代码中并未实际接入**。

| 服务 | 用途 | 在哪里被提到 | 是否必须 |
|------|------|-------------|---------|
| **Neon** | 生产 PostgreSQL 数据库 | `README.md`、`.env.example`、`docs/production-config-checklist.md` | 建议（三选一） |
| **Supabase** | 生产 PostgreSQL 数据库 | `docs/production-config-checklist.md` | 可选 |
| **AWS RDS** | 生产 PostgreSQL 数据库 | `docs/production-config-checklist.md` | 可选 |
| **Vercel** | 前端部署（备选方案） | `docs/deployment-roadmap.md` | 可选 |
| **Cloudflare CDN/DNS** | 域名解析 + CDN 加速 | `docs/production-config-checklist.md`、`apps/web/next.config.ts`（`**.r2.dev` 白名单） | 建议 |

---

## 四、目前未使用（无需考虑）

以下常见第三方服务在代码库中**完全未找到引用**，上线前不需要配置。

| 类别 | 服务 |
|------|------|
| **支付** | Stripe、PayPal、Braintree、支付宝、微信支付 |
| **第三方登录** | Auth0、Clerk、Supabase Auth、Firebase Auth、NextAuth、Google OAuth、GitHub OAuth |
| **错误监控** | Sentry、Bugsnag、Rollbar、Datadog、New Relic、LogRocket |
| **搜索** | Algolia、Typesense、Meilisearch、Elasticsearch |
| **短信** | Twilio、MessageBird、Vonage |
| **人机验证** | reCAPTCHA、hCaptcha、Cloudflare Turnstile |
| **AI / LLM** | OpenAI、Anthropic、Google Gemini |
| **预约调度** | Calendly、Cal.com |

---

## 五、你现在真正需要注册的服务

基于当前代码状态，**上线前必须或建议注册的服务只有以下 4 个**：

| 优先级 | 服务 | 注册地址 | 拿到什么给我 |
|--------|------|---------|-------------|
| 🔴 **必须** | **PostgreSQL 数据库** | [neon.tech](https://neon.tech) 或 [supabase.com](https://supabase.com) | `DATABASE_URL` 连接字符串 |
| 🟠 **强烈建议** | **Cloudflare R2** | [dash.cloudflare.com](https://dash.cloudflare.com) → R2 | `S3_ENDPOINT`、`S3_ACCESS_KEY`、`S3_SECRET_KEY` |
| 🟡 **建议** | **Resend 邮件** | [resend.com](https://resend.com) | `RESEND_API_KEY` |
| 🟢 **可选** | **Google Analytics 4** | [analytics.google.com](https://analytics.google.com) | `NEXT_PUBLIC_GA_ID`（`G-` 开头） |

---

## 六、部署架构

当前规划的部署架构如下：

```
┌─────────────────────────────────────────────────────────────┐
│                          用户                                │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  前端网站  (yezyy.com)                                       │
│  Next.js + React + Tailwind                                 │
│  部署平台：待定（Fly.io / Vercel / 其他）                      │
└───────────────────────────┬─────────────────────────────────┘
                            │  API 请求
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  API 后端  (api.yezyy.com)                                   │
│  Node.js + Fastify + Drizzle ORM                           │
│  部署平台：Fly.io（已配置 fly.toml）                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  PostgreSQL  │ │    Redis     │ │  Cloudflare  │
    │   数据库      │ │    缓存      │ │     R2       │
    │  (生产待定)   │ │  (可选)      │ │   文件存储    │
    └──────────────┘ └──────────────┘ └──────────────┘
```

---

## 七、域名规划建议

| 用途 | 建议域名 | 说明 |
|------|---------|------|
| 网站前端 | `yezyy.com` / `www.yezyy.com` | 用户直接访问 |
| API 后端 | `api.yezyy.com` | 前端调用接口地址 |
| 图片 CDN | `media.yezyy.com` | 图片和文件加速访问 |

> 实际域名配置取决于你的 DNS 提供商（Cloudflare）。

---

## 八、环境变量对应表

| 环境变量 | 对应服务 | 当前值 | 生产值来源 |
|---------|---------|--------|-----------|
| `DATABASE_URL` | PostgreSQL | `postgres://yezz:yezz@localhost:5432/yezz` | Neon / Supabase / RDS |
| `REDIS_URL` | Redis | `redis://localhost:6379` | 可选：Upstash / 自建 |
| `S3_ENDPOINT` | MinIO / R2 | `http://localhost:9000` | Cloudflare R2 |
| `S3_ACCESS_KEY` | MinIO / R2 | `yezz` | Cloudflare R2 |
| `S3_SECRET_KEY` | MinIO / R2 | `yezzsecret` | Cloudflare R2 |
| `S3_BUCKET` | MinIO / R2 | `yezz-media` | 自建 Bucket 名称 |
| `S3_PUBLIC_URL` | MinIO / R2 | `http://localhost:9000/yezz-media` | R2 自定义域名 / `pub-xxx.r2.dev` |
| `RESEND_API_KEY` | Resend | `your_resend_api_key` | Resend 后台 |
| `OWNER_EMAIL` | Resend | `your_email@example.com` | 你的邮箱 |
| `NEXT_PUBLIC_GA_ID` | Google Analytics | 未设置 | GA4 后台 |
| `NEXT_PUBLIC_API_URL` | API 客户端 | `http://localhost:4000` | `https://api.yezyy.com` |
| `NEXT_PUBLIC_SITE_URL` | SEO / Sitemap | 未设置 | `https://yezyy.com` |

---

*本文档由代码扫描自动生成，如有服务变更建议同步更新。*
