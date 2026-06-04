# YEZZ 上线行动清单

> **性质：** 基于全项目代码审计 + 产品分析得出的优先级行动清单  
> **生成日期：** 2026-06-04  
> **目标：** 阶段 A 完成 → 可上线；阶段 B 完成 → 网站能独立运转；阶段 C → 拉开差距

---

## 优先级说明

| 标记 | 含义 |
|------|------|
| 🔴 **必须** | 不修不能上线，直接影响核心路径或安全 |
| 🟠 **重要** | 上线后 2 周内，商业运营基础 |
| 🟡 **提升** | 1 个月内，提升运营效率和用户体验 |

---

## 阶段 A：上线前必须完成

> 预计工期：3～5 天  
> 全部是代码层改动，没有新功能设计，改完即验收

---

### A-1 🔴 修复首页"立即预约"按钮跳转

**问题：** `/book` 路由已被改为 `redirect("/projects")`，但首页 Hero 和 WeChatCTA 区块的 CTA 按钮还在链接 `/book`。用户点"立即预约"→ 静默跳到项目列表 → 不知道怎么预约 → 流失。

**影响文件：**
- `apps/web/components/sections/Hero.tsx:50`
- `apps/web/components/sections/WeChatCTA.tsx:59`

**修复方向：** 将两处链接直接改为 `/projects`（引导选项目），或者恢复 `/book` 为预约引导落地页。

**验收标准：** 首页点"立即预约" → 进入有效的预约引导页面，路径不中断。

---

### A-2 🔴 补全联系页 i18n key

**问题：** 联系页调用了 `t("hours")`、`t("wechat")`、`t("scanWechat")`，但这三个 key 在 `en.json` 和 `zh.json` 中均不存在，用户看到的是原始字符串。

**影响文件：**
- `apps/web/app/[locale]/contact/page.tsx:34,45,68`
- `apps/web/lib/i18n/messages/en.json`
- `apps/web/lib/i18n/messages/zh.json`

**修复方向：** 在两个语言文件的 `contact` 节点下补充 `hours`、`wechat`、`scanWechat` 三个 key，或将页面引用改为已有的 `businessHours`。

**验收标准：** 联系页营业时间、微信标题、扫码提示显示正确的文字内容，中英文均正常。

---

### A-3 🔴 next.config.ts 补充生产 CDN 域名

**问题：** `remotePatterns` 只配置了 `localhost:9000`（本地 MinIO），生产环境 R2/CDN 域名未配置。所有管理员上传的图片在生产网站上显示破图。Admin 后台因为用 `<img>` 标签不受影响，会造成"看起来正常"的假象。

**影响文件：**
- `apps/web/next.config.ts`

**修复方向：** 在 `remotePatterns` 中加入生产 R2 域名，例如：

```ts
{ hostname: "pub-xxxxx.r2.dev" },
{ hostname: "your-cdn.domain.com" },
```

**验收标准：** 生产环境 Admin 上传的图片在公开网站正常显示。

---

### A-4 🔴 修复预约跳转丢失语言前缀

**问题：** `BookNavButton` 使用 `window.location.assign("/cart")` 硬编码路径，中文用户在 `/zh/projects/某产品` 点击预约，被跳转到 `/cart`（无 locale），页面语言重置为默认值。

**影响文件：**
- `apps/web/components/layout/BookNavButton.tsx:25`

**修复方向：** 改为 `router.push(`/${locale}/cart`)` 或等价的带 locale 跳转。

**验收标准：** 在 `/zh/` 路径下点击预约，跳转后 URL 保持 `/zh/cart`，页面语言不重置。

---

### A-5 🔴 Admin JWT 改为 httpOnly Cookie

**问题：** Admin 登录后 JWT 存储在 `localStorage`，容易被 XSS 攻击窃取，一旦泄露攻击者可以完整控制后台。

**影响文件：**
- `apps/api/src/plugins/auth.ts`
- `apps/api/src/routes/v1/auth.routes.ts`
- `apps/web/lib/admin/api.ts`

**修复方向：**
- 登录接口在响应头写 `Set-Cookie: token=<jwt>; HttpOnly; Secure; SameSite=Strict`
- 前端移除手动拼 `Authorization: Bearer` header，依赖浏览器自动携带 cookie
- 新增 `POST /api/v1/auth/logout` 接口清除 cookie

**验收标准：** 登录后 DevTools → Application → Cookies 可见 `HttpOnly: true`，`localStorage` 中无 token。

---

### A-6 🔴 API 故障时显示错误状态，禁止 fallback 假数据

**问题：** API 不可用时，所有页面静默 fallback 到硬编码假数据（含假地址、假电话、picsum 占位图）。用户可能拿着假电话去联系你。

**影响文件：**
- `apps/web/lib/site/data.ts`
- `apps/web/lib/projects/data.ts`

**修复方向：** 生产环境（`NEXT_PUBLIC_USE_API=true`）下，API 请求失败时显示明确的错误状态提示，而不是返回假数据。

**验收标准：** 手动停止 API 服务，公开网站显示"服务暂时不可用，请稍后再试"，而不是假内容。

---

## 阶段 B：上线后 2 周内完成

> 预计工期：2～3 周  
> 完成后网站真正"能独立运转"，不再依赖全人工跟进

---

### B-1 🟠 预约/订单提交后发客户确认邮件

**问题：** 用户提交预约或购物车订单后收不到任何回执，不知道"有没有人收到"，会造成焦虑和重复提交。

**修复方向：**
- `POST /api/v1/bookings` 落库成功后，给客户邮箱发确认邮件
- `POST /api/v1/cart-orders` 落库成功后，给客户邮箱发确认邮件
- 邮件包含：订单号、项目摘要、提交时间、"24小时内联系"承诺语、店铺联系方式

**验收标准：** 提交预约后，客户邮箱 5 分钟内收到包含正确订单摘要的确认邮件。

---

### B-2 🟠 Admin 修改订单状态时自动通知客户

**问题：** 管理员确认/拒绝预约时，客户不知道结果，必须主动联系，运营摩擦极高。

**修复方向：** Admin 在 `PATCH /api/v1/admin/bookings/:id` 修改状态时，自动触发对应邮件：

| 状态变更 | 发给客户的内容 |
|---------|--------------|
| `→ confirmed` | "您的预约已确认！时间：XX，地址：XX" |
| `→ cancelled` | "很遗憾，您的预约无法安排，原因：XX" |

**验收标准：** Admin 点击"确认"→ 客户邮箱收到确认邮件，含时间和地址。

---

### B-3 🟠 统一预约入口，消除双路径歧义

**问题：** `/book`（预约表单）和 `/cart`（购物车结单）并行存在，用户不清楚该走哪条路，Navbar"预约"按钮指向不明确。

**修复方向：** 按项目类型区分路径：

| 项目类型 | 用户路径 |
|---------|---------|
| `experience`（体验项目） | 详情页直接选日期/人数 → 提交预约 |
| `product`（产品项目） | 选风格加购 → 购物车 → 填联系方式 → 提交 |

删除独立的 `/book` 页面，将预约表单内嵌到 `experience` 类型的项目详情页。

**验收标准：** 用户从项目详情页进入，不会面对"预约还是购物车"的选择困境。

---

### B-4 🟠 价格体系规范化，加货币单位

**问题：** 价格字段是随意字符串（如 `"¥88-128"`），没有货币单位，国际用户（澳洲语境）不知道是什么币。

**修复方向：**
- 数据库新增 `price_min`、`price_max`、`price_currency` 字段
- API 返回统一格式的 `priceDisplay`（如 `AUD $88 - $128`）
- 前端展示组件统一消费 `priceDisplay`

**验收标准：** 所有项目卡片、详情页、购物车中价格格式统一，有明确货币单位。

---

### B-5 🟠 sitemap 加入动态项目详情页 URL

**问题：** 当前 `sitemap.xml` 只包含 5 个静态路由，50 个项目详情页全部未被收录，本地搜索流量损失严重。

**影响文件：**
- `apps/web/app/sitemap.ts`

**修复方向：** 在 `sitemap()` 函数中调用 API 获取所有项目 slug，动态生成每个项目详情页的 URL。

**验收标准：** 访问 `/sitemap.xml`，可以看到所有项目详情页的 URL 条目。

---

### B-6 🟠 接入 GA4，埋 3 个核心事件

**问题：** 没有任何用户行为数据，不知道用户在哪里流失，产品迭代靠猜。

**修复方向：** 接入 Google Analytics 4，至少埋以下事件：

```typescript
ga4.track('view_project', { project_slug, project_name })
ga4.track('submit_booking', { project_slug, date, people_count })
ga4.track('submit_cart_order', { item_count })
```

**验收标准：** GA4 实时报告中可以看到上述事件触发。

---

## 阶段 C：1 个月内持续迭代

> 做了会拉开与同类网站的差距

---

### C-1 🟡 档期管理系统

用户选日期时能看到哪天有空位、哪天已满，管理员可在 Admin 设置可用时段。这是将"联系表单"升级为"真实预约系统"的关键。

---

### C-2 🟡 Admin 未读角标

新订单进来时，Admin Sidebar 自动出现角标数字，无需手动刷新。实现方案：每 30 秒 polling 一次未读数接口。

---

### C-3 🟡 购物车 session 持久化完整落地

购物车数据同步到服务端，换浏览器/清缓存不丢失，7 天后自动过期。（逻辑已写，需完整验收）

---

### C-4 🟡 Admin 多角色权限

新增 `staff` 角色，可以管理预约和订单，但不能编辑内容和设置。不再所有人共用一个密码。

---

### C-5 🟡 Magic Link 订单查询

确认邮件中附带一次性链接，客户可以主动查看订单当前状态，无需注册账号。

---

## 执行次序建议

```
本周:    A-1 → A-2 → A-3 → A-4   （纯代码修复，半天能完成）
本周内:  A-5 → A-6                （安全 + 数据可靠性）

第 2 周: B-1 → B-2               （闭合商业通知循环）
第 3 周: B-3 → B-4               （统一用户路径 + 价格规范）
第 4 周: B-5 → B-6               （SEO + 数据）

之后按需: C-1 → C-2 → C-3 → C-4 → C-5
```

---

## 附：一条流程建议

上述问题中，超过一半早已记录在 `BUG_AND_ISSUES.md` 中，但仍未修复。

建议在合并代码前增加一条硬性规则：**走一遍核心用户路径验收**——从首页进入、选项目、点预约、走完完整流程，确认每一步不中断。

文档写得再好，不等于 Bug 修了。

---

> 关联文档：  
> - [BUG_AND_ISSUES.md](./BUG_AND_ISSUES.md) — 代码层 Bug 详细记录  
> - [COMMERCIAL_ROADMAP.md](./COMMERCIAL_ROADMAP.md) — 商业化完整路线图
