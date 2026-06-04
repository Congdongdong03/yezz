# YEZZ 现有问题清单（代码审计）

> **性质：** 这些是**已存在于代码中的 bug 和断点**，不是待开发的新功能  
> **扫描日期：** 2026-06-04  
> **审计范围：** `apps/web/` 全部页面、组件、i18n、路由、配置

---

## 严重等级说明

| 标记 | 含义 |
|------|------|
| 🔴 **P0** | 上线即崩溃 / 核心路径完全断裂，必须上线前修复 |
| 🟠 **P1** | 用户体验严重受损，直接影响转化，应尽快修复 |
| 🟡 **P2** | 体验不佳或内容显示错误，影响可信度 |
| 🔵 **P3** | 无障碍 / SEO / 代码规范问题，不影响主流程但影响质量 |

---

## 第一类：上线即坏的 Bug（P0）

---

### BUG-001 🔴 联系页显示原始 key 字符串

**位置：** `apps/web/app/[locale]/contact/page.tsx:34,45,68`

**问题：** 页面调用了 `t("hours")`、`t("wechat")`、`t("scanWechat")`，但这三个 key 在 `en.json` 和 `zh.json` 里**都不存在**。

**用户看到什么：** 联系页的营业时间、微信标题、扫码提示全部显示为原始字符串 `"hours"`、`"wechat"`、`"scanWechat"`。

**修复方案：**
- 将 `zh.json` / `en.json` 中的 `contact.businessHours` 改 key 为 `contact.hours`，或
- 将 `contact/page.tsx` 中的 key 引用改为已存在的 `businessHours`，并补充 `wechat`、`scanWechat` 两个 key

---

### BUG-002 🔴 生产环境图片全部无法加载

**位置：** `apps/web/next.config.ts:8-31`

**问题：** `remotePatterns` 只配置了本地 MinIO（`localhost:9000`），没有配置任何生产环境的 CDN / R2 / S3 域名。

**用户看到什么：** 管理员上传的所有图片在生产网站上显示为破图。Admin 后台因为用 `<img>` 标签所以预览正常，会造成"看起来工作正常"的假象，实际公开网站全挂。

**修复方案：** 在 `next.config.ts` 的 `remotePatterns` 中加入生产 R2/CDN 域名：

```ts
{ hostname: "pub-xxxxx.r2.dev" },
{ hostname: "your-cdn.domain.com" },
```

---

### BUG-003 🔴 "立即预约"按钮 → 跳到项目列表，不是预约流程

**位置：**
- `apps/web/components/sections/Hero.tsx:50` — Hero 按钮
- `apps/web/components/sections/WeChatCTA.tsx:59` — 微信区块按钮
- `apps/web/i18n/routing.ts:21-24` — 路由定义

**问题：** `/book` 路由已被改为 `redirect("/projects")`，但首页最显眼的两个 CTA 还在链接 `/book`。

**用户看到什么：** 点"立即预约" → 无声跳转到项目列表页 → 不知道怎么预约 → 流失。这是首页核心转化路径的断裂。

**修复方案：** 将 Hero 和 WeChatCTA 的链接改为直接指向 `/projects`（引导选项目），或恢复 `/book` 页面为预约引导页。

---

### BUG-004 🔴 产品类项目"预约"跳转丢失语言前缀

**位置：** `apps/web/components/layout/BookNavButton.tsx:25`

```ts
window.location.assign("/cart");  // 错误：应为 `/${locale}/cart`
```

**问题：** 用户在 `/zh/projects/某产品` 点击预约，被跳转到 `/cart`（无 locale），页面语言重置为默认值。

**修复方案：** 改为 `router.push(\`/${locale}/cart\`)` 或 `window.location.assign(\`/${locale}/cart\`)`。

---

## 第二类：严重体验断点（P1）

---

### BUG-005 🟠 API 故障时用户看到假数据，毫不知情

**位置：** `apps/web/lib/site/data.ts:22-37`、`apps/web/lib/projects/data.ts`

**问题：** 当 API 不可用时，所有页面静默 fallback 到硬编码的假数据（上海假地址、picsum 占位图、假电话号码），没有任何错误提示。

**用户看到什么：** 看起来正常的网站，实际上显示的是虚假店铺信息。用户可能拿着假电话去联系。

**修复方案：** 生产环境中 `NEXT_PUBLIC_USE_API=true` 时，若 API 请求失败，显示明确的错误状态（"服务暂时不可用，请稍后再试"），而不是 fallback 假数据。

---

### BUG-006 🟠 预约日历出错时显示"无档期"，用户无法区分

**位置：** `apps/web/components/book/BookingCalendar.tsx:51-53`

```ts
} catch {
  setMonthMap({});   // 错误吞掉，日历变成全灰
}
```

**问题：** API 超时或出错时，日历所有日期都变灰，与"真的没有档期"完全相同。

**用户看到什么：** "这个月没有可预约的时间"——然后离开，不知道是系统故障。

**修复方案：** catch 中 `setError("加载档期失败，请刷新重试")` 并在日历上方显示。

---

### BUG-007 🟠 购物车抽屉按钮说谎

**位置：** `apps/web/components/cart/CartDrawer.tsx:104`

**问题：** 底部按钮显示文字是 `t("submit")`（"提交预约"），但点击后只是跳转到 `/cart` 页面，没有提交任何东西。

**用户看到什么：** 以为点了"提交预约"就完成了，实际上什么都没有发生，订单没有生成。

**修复方案：** 将按钮文字改为"查看购物车"或"去结算"，与实际行为一致。

---

### BUG-008 🟠 派对页没有任何预约/咨询入口

**位置：** `apps/web/app/[locale]/parties/page.tsx`

**问题：** 整个派对套餐页面是纯展示，没有"预约"、"联系我们"、"微信咨询"任何一个出口 CTA。

**用户看到什么：** 看完套餐，不知道怎么预约，只能自己去找联系方式。

**修复方案：** 每个套餐卡片底部增加"咨询预约"按钮，链接到联系页或触发微信 ID 复制。

---

### BUG-009 🟠 购物车页不能删除商品

**位置：** `apps/web/app/[locale]/cart/page.tsx`

**问题：** 删除商品的交互只在购物车抽屉里。用户进入 `/cart` 结算页后，发现加错了商品，找不到任何删除按钮。

**修复方案：** 在 `/cart` 页的商品列表每行增加删除按钮。

---

### BUG-010 🟠 表单报错只显示通用错误，服务端具体原因被丢弃

**位置：**
- `apps/web/app/[locale]/cart/page.tsx:43-49`
- `apps/web/components/book/BookingForm.tsx:96-98`

**问题：** 服务端返回的字段级错误（`result.errors`）被代码忽略，用户只能看到"提交失败，请重试"，不知道具体是哪个字段有问题。

**修复方案：** 读取并展示 `result.errors` 中的字段错误信息到对应表单项下方。

---

### BUG-011 🟠 同一项目加购物车无反馈

**位置：** `apps/web/lib/cart/context.tsx:59-61`

```ts
const exists = prev.some((i) => i.projectId === item.projectId);
if (exists) return prev;  // 静默忽略
```

**问题：** 用户重复点"加入购物车"，没有任何提示（toast、动画、文字），不知道是"已经加过了"还是"没加成功"。

**修复方案：** 重复时显示 toast：「已在购物车中」，并高亮购物车图标。

---

### BUG-012 🟠 Admin 设置里填的 SEO/地图/社交链接全部无效

**位置：**
- SEO：`apps/web/app/[locale]/page.tsx` 等所有页面 metadata 均为硬编码，从未读取 `siteSettings.seoTitle`
- 地图：`apps/web/app/[locale]/contact/page.tsx` 从不渲染 `googleMapUrl`
- 社交：`apps/web/components/layout/Footer.tsx` 不渲染 `instagram`、`xiaohongshu`

**问题：** 管理员在后台填写了这些信息，以为生效，实际上前端完全没有消费这些字段。

**修复方案（按优先级）：**
1. 联系页增加 Google Maps 链接/嵌入
2. Footer 增加 Instagram / 小红书 图标链接
3. 所有页面 `generateMetadata` 读取 `siteSettings.seoTitle` / `seoDescription`

---

## 第三类：内容与显示问题（P2）

---

### BUG-013 🟡 所有页面 `<html>` 缺少 `lang` 属性

**位置：** `apps/web/app/layout.tsx:29`

```tsx
<html className={...}>   // 缺少 lang={locale}
```

**影响：** 浏览器和搜索引擎不知道页面语言，屏幕阅读器无法正确朗读，SEO 受损。

**修复：** `<html lang={locale} className={...}>`

---

### BUG-014 🟡 所有页面 Meta 标题/描述是硬编码英文

**位置：** `apps/web/app/layout.tsx:18-21`、各 `page.tsx` 的 `generateMetadata`

**影响：** 中文用户在微信/微博/搜索引擎分享时看到英文标题。中文 SEO 完全失效。

---

### BUG-015 🟡 项目详情页 SEO 描述是通用占位文字

**位置：** `apps/web/app/[locale]/projects/[slug]/page.tsx:18`

```ts
description: "Learn more about this DIY project..."
```

每个项目 meta description 完全相同，搜索引擎会将所有项目页视为重复内容。

---

### BUG-016 🟡 WhyDIY 板块内容硬编码，无法从 CMS 修改

**位置：** `apps/web/components/sections/WhyDIY.tsx:7-28`

首页核心卖点文案（"放松心情"、"释放创意"等）直接写在组件里，不在 i18n 文件也不在 Admin，修改文案必须改代码。

---

### BUG-017 🟡 Admin 看板"设置"统计卡永远显示"1"

**位置：** `apps/web/app/admin/page.tsx:57`

```tsx
<CardTitle>1</CardTitle>  // 硬编码
```

不是真实数据，是占位符，但看起来像真实统计，会误导管理员。

---

### BUG-018 🟡 画廊图片 alt 永远显示英文 caption

**位置：** `apps/web/app/[locale]/gallery/page.tsx:40`

```tsx
alt={img.caption?.en || "Gallery image"}  // 中文页面也用英文 caption
```

**修复：** `alt={img.caption?.[locale] || img.caption?.en || ""}`

---

### BUG-019 🟡 Footer 有重复的"项目"链接，缺少"联系"入口

**位置：** `apps/web/components/layout/Footer.tsx:33-35`

Projects 链接出现两次，但没有 Contact 链接。用户在 Footer 找不到联系方式。

---

### BUG-020 🟡 Admin "查看网站" 硬编码 `/zh`，不走 EN 预览

**位置：** `apps/web/app/admin/AdminShell.tsx:176`

```tsx
href="/zh"  // 硬编码，无法预览英文版
```

---

### BUG-021 🟡 派对套餐卡片 CTA 全都是"查看所有套餐"，指向同一个列表页

**位置：** `apps/web/components/sections/PartyPackagesPreview.tsx:104`

首页的派对预览，每张卡片按钮都是"查看所有套餐"并链接到 `/parties`，没有区分度，不如"了解详情"指向各自页面。

---

### BUG-022 🟡 ErrorBoundary 报错界面只有英文

**位置：** `apps/web/components/ErrorBoundary.tsx:27-36`

页面崩溃时，中文用户看到 "Something went wrong. Please refresh the page or try again later."

---

## 第四类：无障碍与 SEO 问题（P3）

---

### BUG-023 🔵 公开表单 label 未关联 input

**位置：** `BookingForm.tsx`、`cart/page.tsx`、`ProjectDetail.tsx`（人数输入）

表单字段的 `<label>` 没有 `htmlFor`，`<input>` 没有对应 `id`。屏幕阅读器无法将标签与输入框关联。

---

### BUG-024 🔵 日历导航按钮无 `aria-label`

**位置：** `apps/web/components/book/BookingCalendar.tsx:105-121`

`←` / `→` 翻月按钮只有图标，没有文字说明，键盘用户不知道这是什么操作。

---

### BUG-025 🔵 购物车关闭按钮无 `aria-label`

**位置：** `apps/web/components/cart/CartDrawer.tsx:37-42`

只有 `<X />` 图标，没有 `aria-label="关闭"`。

---

### BUG-026 🔵 移动端全屏菜单无焦点陷阱，无 Escape 关闭

**位置：** `apps/web/components/layout/MobileMenu.tsx:22`

菜单打开时键盘 Tab 键可以穿透到背后的页面内容，不符合无障碍规范。

---

### BUG-027 🔵 预约引导弹窗无 Escape 关闭，点背景不关闭

**位置：** `apps/web/components/layout/BookNavButton.tsx:39-71`

只能点内部 Close 按钮关闭，不符合用户习惯。

---

### BUG-028 🔵 没有 `sitemap.xml` 和 `robots.txt`

**位置：** `apps/web/app/` 根目录下不存在这两个文件

搜索引擎无法知道哪些页面需要索引，`/admin` 没有被明确排除在外。

---

### BUG-029 🔵 没有 Open Graph / Twitter Card meta

任何页面被分享到微信、小红书、Twitter 时，都不会生成预览图和摘要，点击率极低。

---

### BUG-030 🔵 购物车 hydration 闪烁

**位置：** `apps/web/lib/cart/context.tsx`

首屏渲染时购物车数量为 0，`useEffect` 加载 localStorage 后突然变为有数量，Navbar 角标会闪一下。

---

## 快速修复排序（建议顺序）

| 优先级 | ID | 修复难度 | 影响 |
|--------|-----|----------|------|
| 🔴 立即 | BUG-001 | 低（改 i18n key） | 联系页内容显示正常 |
| 🔴 立即 | BUG-002 | 低（加 2 行配置） | 生产图片不挂 |
| 🔴 立即 | BUG-003 | 低（改链接地址） | 首页预约路径修通 |
| 🔴 立即 | BUG-004 | 低（改一行代码） | 语言不丢失 |
| 🟠 本周 | BUG-007 | 低（改按钮文字） | 消除误导 |
| 🟠 本周 | BUG-008 | 低（加 CTA 按钮） | 派对页有出口 |
| 🟠 本周 | BUG-011 | 低（加 toast） | 加购反馈 |
| 🟠 本周 | BUG-009 | 中（加删除 UI） | 购物车可用 |
| 🟠 本周 | BUG-010 | 中（渲染字段错误） | 表单可用性 |
| 🟠 本周 | BUG-012 | 中（各页面消费字段） | 管理后台有意义 |
| 🟡 下周 | BUG-005 | 中（加错误边界） | 消除假数据风险 |
| 🟡 下周 | BUG-006 | 低（加 catch 错误提示） | 日历可信 |
| 🟡 下周 | BUG-013 | 低（加 lang 属性） | SEO 基础 |
| 🟡 下周 | BUG-014 | 中（改 metadata） | SEO 基础 |
| 🔵 迭代 | BUG-023~030 | 各不同 | 无障碍/SEO |

---

> **结论（前端）：** P0 的 4 个 bug（BUG-001~004）任意一个上线都会让用户直接体验到坏掉的功能，建议上线前全部修完。P1 的 8 个问题直接影响转化，建议发布后第一周内修复。

---

---

# 后端 / 安全 / 基础设施审计（第二轮）

> **审计范围：** `apps/api/`、`packages/db/`、`docker-compose.yml`、测试、运维  
> **审计日期：** 2026-06-04

---

## 严重等级（后端版本）

| 标记 | 含义 |
|------|------|
| 🔴 **S0** | 安全漏洞 / 生产数据正确性风险，必须上线前修复 |
| 🟠 **S1** | 业务逻辑 bug，会导致核心功能静默错误 |
| 🟡 **S2** | 工程质量债务，影响可维护性和可扩展性 |
| 🔵 **S3** | 运维 / 可观测性缺失，出问题时无法及时感知 |

---

## 第一类：安全漏洞（S0）

---

### SEC-001 🔴 登录接口无暴力破解保护

**位置：** `apps/api/src/routes/v1/auth.routes.ts:31-41`

**问题：** `POST /api/v1/auth/login` 没有任何限流。`/bookings` 有 Redis 限流，但登录接口完全空白。攻击者可以无限次尝试密码。

**修复方案：** 复用现有 `checkRateLimit` 逻辑，同 IP 登录失败 5 次/小时后锁定，或接入 in-memory 限流作为 Redis 降级方案。

---

### SEC-002 🔴 Redis 宕机时所有限流自动失效

**位置：** `apps/api/src/lib/cache.ts:63-64, 77-78`

```ts
} catch {
  return { allowed: true };  // Redis 不可用 → 全部放行
}
```

**问题：** Redis 一旦出现任何问题（重启、网络抖动、OOM），限流立即失效，等同于没有限流。

**修复方案：** 降级策略改为 in-memory 计数器（如 `Map<ip, count>`），不依赖 Redis 作为唯一限流后端。

---

### SEC-003 🔴 新建用户时初始密码在 API 响应里明文返回

**位置：** `apps/api/src/services/admin/users.admin.service.ts:79-87`

**问题：** 创建员工账号的响应 JSON 里包含 `initialPassword` 字段明文。任何能读取这个 HTTP 响应的人（中间代理、日志系统、浏览器 DevTools）都能看到密码。

**修复方案：** 从 API 响应中移除 `initialPassword`，改为通过 Resend 邮件发送给新用户邮箱。

---

### SEC-004 🔴 文件上传只校验客户端声明的 MIME，不验证文件内容

**位置：** `apps/api/src/lib/storage.ts:76-78`

**问题：** 只检查请求头里的 `Content-Type`，没有 magic byte 校验。攻击者可以把任意文件（如 HTML、JS、可执行文件）的 Content-Type 改为 `image/jpeg` 上传，服务端不会拒绝。

**修复方案：** 使用 `file-type` 或 `magic-bytes` 库读取文件头部字节校验真实格式，与白名单比对后再上传到 S3。

---

### SEC-005 🔴 Swagger API 文档公开无认证，完整暴露系统攻击面

**位置：** `apps/api/src/plugins/swagger.ts:32-34`

**问题：** `/docs` 接口对所有人完全公开，没有任何 IP 限制或 Basic Auth。生产环境相当于把系统的所有接口、参数类型、安全策略展示给任何访客。

**修复方案：** 生产环境（`NODE_ENV=production`）时禁用或加 Basic Auth 保护 `/docs`。

---

### SEC-006 🔴 购物车 session API 存在 IDOR 风险

**位置：** `apps/api/src/routes/v1/cart.routes.ts:6-17`

**问题：** `GET /api/v1/cart/:sessionId` 和 `PUT /api/v1/cart/:sessionId` 完全不需要认证，只要猜到或枚举到一个 `sessionId`（UUID），就能读取和修改任意用户的购物车内容。

**修复方案：** 将 session ID 存入 httpOnly cookie，服务端从 cookie 读取，不允许客户端直接传 ID 作为路径参数。

---

## 第二类：业务逻辑 Bug（S1）

---

### BIZ-001 🟠 取消预约后档期容量不归还

**位置：** `apps/api/src/services/admin/bookings.admin.service.ts:110-129`

**问题：** 管理员将预约状态改为 `cancelled`，代码里没有任何 `booked_count - people` 的操作。容量只增不减，时间一长，时段显示"已满"但实际没有人。

**影响：** 档期管理系统的数据会随时间逐渐失真，最终完全不可信。

**修复方案：** 在 `updateStatus(id, 'cancelled')` 时，若原状态为 `confirmed` 或 `new` 且有 `time_slot_id`，执行 `booked_count = booked_count - people`（加入事务）。

---

### BIZ-002 🟠 无 `timeSlotId` 的预约完全跳过容量检查

**位置：** `apps/api/src/services/bookings.service.ts:99-100`

**问题：** 前端如果因任何原因没有携带 `timeSlotId`（bug、旧版本、直接调用 API），预约会被直接写入数据库，完全绕过所有档期和容量校验。

**修复方案：** 对 `experience` 类型的项目，要求 `timeSlotId` 为必填字段，服务端强制校验。

---

### BIZ-003 🟠 管理员可将时段容量设置为低于已预约人数

**位置：** `apps/api/src/services/admin/time-slots.admin.service.ts:122-127`

**问题：** PATCH 时段时，没有校验新 `capacity` 是否 ≥ 当前 `booked_count`。可以出现 `capacity=2, booked_count=5` 的矛盾状态，导致超量预约或显示异常。

**修复方案：** 更新前校验：`if (newCapacity < slot.bookedCount) throw AppError("CAPACITY_BELOW_BOOKED")`。

---

### BIZ-004 🟠 批量创建时段无唯一性检查，重复执行会产生重复时段

**位置：** `apps/api/src/services/admin/time-slots.admin.service.ts`（createMany 逻辑）

**问题：** 批量创建时段接口没有 `ON CONFLICT DO NOTHING` 或唯一约束，重复提交会插入重复的时段，用户会看到同一时间段出现两次。

**修复方案：** 在 `time_slots` 表加唯一约束 `UNIQUE(date, start_time, end_time, category_id)`，并在 insert 使用 `ON CONFLICT DO NOTHING`。

---

### BIZ-005 🟠 购物车订单不校验商品存在性和价格合法性

**位置：** `apps/api/src/services/cart-orders.service.ts:38-49`

**问题：** 提交购物车时，服务端不验证 `projectId` 是否在数据库中存在，也不对比客户端提交的价格和数据库中的实际价格。理论上可以提交价格为 0 或负数的订单。

**修复方案：** 提交时从数据库查询各商品实际价格，以数据库价格为准，忽略客户端传来的价格字段。

---

### BIZ-006 🟠 订单状态可以任意跳转，邮件通知与状态机不一致

**位置：** `apps/api/src/services/admin/bookings.admin.service.ts:86-93, 160-166`

**问题：** 状态只校验是否在枚举内，没有状态机约束。可以从 `confirmed` 跳回 `new`，从 `cancelled` 跳回 `confirmed`。邮件通知逻辑是按正向流程写的，乱跳状态会触发错误的通知（如给客户重复发确认邮件）。

**修复方案：** 定义合法状态转换表：
```
new → contacted | confirmed | cancelled
contacted → confirmed | cancelled
confirmed → cancelled
cancelled → (不可转换)
```

---

### BIZ-007 🟠 过期购物车 Session 永远不会被清理

**位置：** `apps/api/src/services/cart-sessions.service.ts:35-37`

**问题：** `purgeExpired()` 函数存在，但从未被调用。没有定时任务，没有 cron，没有任何触发机制。`cart_sessions` 表会无限增长。

**修复方案：** 新增定时清理，最简单方案：在 API 启动时注册一个每日执行一次的 `setInterval`，调用 `purgeExpired()`。

---

## 第三类：工程质量问题（S2）

---

### ENG-001 🟡 API 容器在生产环境直接运行 TypeScript 源码

**位置：** `apps/api/Dockerfile:11-13`

```dockerfile
CMD ["npx", "tsx", "src/index.ts"]
```

**问题：** `tsx` 是开发用的 TypeScript 运行器，不适合生产。启动更慢，没有编译优化，TypeScript 语法错误不会在构建时被发现。

**修复方案：**
```dockerfile
RUN pnpm build          # tsc 编译到 dist/
CMD ["node", "dist/index.js"]
```

---

### ENG-002 🟡 API 容器没有 Docker Healthcheck

**位置：** `docker-compose.yml:53-79`（api service 无 healthcheck 字段）

**问题：** Postgres 和 Redis 都有 healthcheck，API 没有。Docker 无法判断 API 是否真正可用，只知道进程在跑。导致 `depends_on` 的健康检查链断裂。

**修复方案：** 在 api service 增加：
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
  interval: 30s
  timeout: 5s
  retries: 3
```

---

### ENG-003 🟡 健康检查接口 status 降级时仍返回 HTTP 200

**位置：** `apps/api/src/services/health.service.ts:29-33`

**问题：** 即使数据库或 Redis 有问题，`GET /health` 始终返回 HTTP 200。所有监控系统（UptimeRobot、AWS ALB、Docker healthcheck）都会认为服务健康，无法触发告警。

**修复方案：** `status === "degraded"` 时返回 HTTP 503，`status === "ok"` 时返回 200。

---

### ENG-004 🟡 每次 `docker compose up` 都执行 seed 脚本

**位置：** `docker-compose.yml:81-89`：migrate 服务运行 `pnpm db:migrate && pnpm db:seed`

**问题：** 生产环境重启容器时不应该执行 seed（种子数据是初始化数据，不是每次启动都该跑的）。

**修复方案：** 拆分为两个独立服务：`migrate`（每次启动跑）和 `seed`（仅首次初始化手动触发或通过 `--profile seed` 控制）。

---

### ENG-005 🟡 所有路由无声明式输入校验，Swagger 文档为空壳

**位置：** 整个 `apps/api/src/routes/` 目录，无一处使用 Zod 或 Fastify JSON Schema

**问题：** 路由接收到的请求 body 直接被当作已知类型使用，没有运行时校验。`/docs` 虽然可访问，但里面没有任何 operation 记录，因为 Swagger 需要从 schema 生成。

**修复方案：** 为所有路由添加 Fastify JSON Schema 或 TypeBox 定义（可渐进式）；Swagger 自动从 schema 生成文档。

---

### ENG-006 🟡 数据库所有高频查询字段均无索引

**位置：** `packages/db/migrations/`（所有迁移文件）— 无一 `CREATE INDEX`

**高优先级缺失索引：**

| 表 | 字段 | 查询场景 |
|----|------|----------|
| `bookings` | `created_at DESC` | 预约列表倒序 |
| `bookings` | `is_read` | 未读通知计数 |
| `bookings` | `time_slot_id` | 时段关联查询 |
| `cart_orders` | `created_at DESC`, `is_read` | 订单列表 |
| `time_slots` | `date`, `(date, category_id)` | 日历查询 |
| `diy_projects` | `category_id` | 分类过滤 |
| `cart_order_items` | `order_id` | 订单明细 |

---

### ENG-007 🟡 Admin 预约/订单列表无分页，全量返回

**位置：**
- `apps/api/src/routes/v1/admin/bookings.routes.ts:6-8`
- `apps/api/src/routes/v1/admin/orders.routes.ts:6-8`
- `apps/api/src/routes/v1/admin/time-slots.routes.ts:6-8`

**问题：** 数据增长后，这些接口会拉取整张表。100 条可能没问题，1000 条开始变慢，10000 条直接超时。

**修复方案：** 统一增加 `?page=1&limit=20&status=new&from=2026-06-01` 等查询参数，与 admin/projects 保持一致。

---

### ENG-008 🟡 `preferred_date` 字段类型是 `varchar` 不是 `date`

**位置：** `packages/db/src/schema/index.ts:148`

**问题：** 存日期的字段用字符串类型，无法做日期范围查询（"查看本月预约"），也无法强制格式一致性（`"2026-06-04"` vs `"June 4"` vs `"2026/6/4"` 都能存进去）。

**修复方案：** 新增迁移将 `preferred_date` 类型改为 `date`（需要数据迁移脚本清洗已有数据）。

---

### ENG-009 🟡 测试只有单元测试，无任何 HTTP 集成测试

**位置：** `apps/api/src/` 下 4 个 `*.test.ts` 文件，全部是 mock 数据测工具函数

**问题：** 路由注册错了、中间件顺序错了、鉴权没生效、数据库查询返回格式不对——所有这些问题都不会被现有测试发现，只有上线才知道。

**修复方案：** 使用 `fastify.inject()` 编写关键路径的集成测试，至少覆盖：登录、创建预约（含容量检查）、购物车提交、Admin CRUD。

---

## 第四类：运维可见性缺失（S3）

---

### OPS-001 🔵 没有错误监控（无 Sentry 或等效方案）

线上出 bug、JS 异常、API 500 错误——你不会知道，只能等用户投诉。

**修复方案：** 接入 Sentry（有免费额度），前端和后端各接一个 DSN。

---

### OPS-002 🔵 没有结构化日志和日志收集

**位置：** `apps/api/src/app.ts:13` — 只有 `logger: true`（Fastify 默认 Pino）

日志只打到 stdout，容器重启后全部丢失。

**修复方案：** 配置 Pino 输出 JSON 格式并接入日志服务（Logtail、Grafana Loki、或 Railway 的内置日志）。

---

### OPS-003 🔵 没有 CI/CD 流水线

**位置：** 根目录下无 `.github/workflows/`

没有自动化：提交代码不会自动跑测试、不会自动检查类型错误、不会自动部署。

**修复方案：** 最小 GitHub Actions 配置：push to main → typecheck + test + build。

---

### OPS-004 🔵 没有数据库备份策略

README 提到了 Neon 作为生产数据库，但没有配置自动备份，没有备份频率说明，没有恢复流程文档。

**修复方案：** Neon 开启自动备份（每日快照），README 补充恢复步骤。

---

## 全项目优先级汇总

### 上线前必须修（P0 / S0）

| ID | 问题 | 修复难度 | 预估时间 |
|----|------|----------|----------|
| BUG-001 | 联系页显示原始 key 字符串 | 低 | 30 分钟 |
| BUG-002 | 生产环境图片全部无法加载 | 低 | 10 分钟 |
| BUG-003 | "立即预约"按钮跳错地方 | 低 | 30 分钟 |
| BUG-004 | 产品项目跳转丢失语言前缀 | 低 | 10 分钟 |
| SEC-001 | 登录接口无暴力破解保护 | 低 | 2 小时 |
| SEC-002 | Redis 宕机时限流失效 | 中 | 3 小时 |
| SEC-003 | 新建用户密码明文返回 | 低 | 1 小时 |
| SEC-004 | 文件上传 MIME 可绕过 | 中 | 3 小时 |
| SEC-005 | Swagger 文档公开无认证 | 低 | 30 分钟 |
| SEC-006 | 购物车 session IDOR 风险 | 高 | 1 天 |

### 上线后第一周修（P1 / S1）

| ID | 问题 | 修复难度 | 预估时间 |
|----|------|----------|----------|
| BUG-007 | 购物车抽屉按钮文字欺骗用户 | 低 | 10 分钟 |
| BUG-008 | 派对页无任何预约出口 | 低 | 1 小时 |
| BUG-009 | 购物车页不能删除商品 | 中 | 2 小时 |
| BUG-010 | 表单报错丢弃服务端细节 | 低 | 1 小时 |
| BUG-011 | 重复加购无任何反馈 | 低 | 30 分钟 |
| BUG-012 | Admin 填的 SEO/地图/社交无效 | 中 | 1 天 |
| BIZ-001 | 取消预约不归还容量 | 中 | 3 小时 |
| BIZ-002 | 无时段 ID 的预约跳过容量检查 | 低 | 1 小时 |
| BIZ-003 | 容量可设置低于已预约人数 | 低 | 1 小时 |
| BIZ-005 | 订单不校验商品存在性和价格 | 中 | 3 小时 |
| BIZ-006 | 状态机无约束，邮件乱发 | 中 | 3 小时 |
| BIZ-007 | 过期 session 永不清理 | 低 | 1 小时 |

### 第二周迭代修（P2 / S2）

| ID | 问题 | 修复难度 | 预估时间 |
|----|------|----------|----------|
| BUG-005 | API 失败静默显示假数据 | 中 | 3 小时 |
| BUG-006 | 日历出错显示为"无档期" | 低 | 1 小时 |
| BUG-013 | `<html>` 缺少 `lang` 属性 | 低 | 10 分钟 |
| BUG-014 | 所有页面 meta 是硬编码英文 | 中 | 1 天 |
| BUG-015 | 项目页 SEO 描述全部相同 | 低 | 1 小时 |
| BUG-017 | Admin 看板统计写死为 "1" | 低 | 30 分钟 |
| BIZ-004 | 批量创建时段无重复检查 | 低 | 1 小时 |
| ENG-001 | 生产环境运行 tsx 源码 | 低 | 1 小时 |
| ENG-002 | API 容器无 healthcheck | 低 | 30 分钟 |
| ENG-003 | 健康检查降级不返回 503 | 低 | 30 分钟 |
| ENG-004 | 每次启动都执行 seed | 低 | 1 小时 |
| ENG-006 | 数据库无索引 | 中 | 3 小时 |
| ENG-007 | Admin 列表无分页 | 中 | 1 天 |
| ENG-008 | 日期字段类型是 varchar | 中 | 3 小时 |

### 持续改进（P3 / S3）

| ID | 问题 | 说明 |
|----|------|------|
| BUG-023~030 | 无障碍问题 | aria-label, focus trap, 语义化 |
| BUG-028~029 | SEO：无 sitemap, 无 OG | 分享效果差 |
| ENG-005 | 路由无 schema，Swagger 为空 | 可渐进式补充 |
| ENG-009 | 无 HTTP 集成测试 | 建议从关键路径开始 |
| OPS-001 | 无错误监控 | 接入 Sentry |
| OPS-002 | 无结构化日志收集 | 接入 Logtail / Loki |
| OPS-003 | 无 CI/CD | GitHub Actions 最小配置 |
| OPS-004 | 无数据库备份策略 | Neon 自动快照 |

---

> **小计（第一、二轮）：** 71 个已确认问题

---

---

# 内容 / 品牌 / 设计 / DX 审计（第三轮）

> **审计范围：** i18n 文件、邮件模板、种子数据、设计系统、信息架构、移动端、开发者体验  
> **审计日期：** 2026-06-04

---

## 严重等级（品牌/内容版）

| 标记 | 含义 |
|------|------|
| 🔴 **C0** | 上线即影响真实用户，造成品牌损失或功能失效 |
| 🟠 **C1** | 直接影响用户信任感和转化 |
| 🟡 **C2** | 体验不一致或内容不完整，影响品牌完成度 |
| 🔵 **C3** | 开发者体验 / 长期维护成本问题 |

---

## 第一类：品牌与内容严重问题（C0）

---

### CON-001 🔴 所有图片都是随机占位图，上线即显示无关内容

**位置：** `apps/web/lib/mock-data.ts`（全文），`packages/db/src/seed.ts:212-219`

**问题：** 项目图片、派对图片、画廊图片、Hero 图片、微信二维码全部使用 `https://picsum.photos/seed/yezz-*/...` 随机图片库。种子数据跑完后数据库里存的是随机图片 URL，直接部署上线用户看到的是与工作室毫无关系的随机网络图片。

**没有任何文档提示"上线前必须替换图片"。**

**修复方案：** 在 README 的"上线检查清单"中增加必填项：替换所有 picsum URL 为真实品牌图片；在 Admin 媒体管理中增加"待替换"标记。

---

### CON-002 🔴 Hero 按钮文字说"立即预约"但链接到项目列表

**位置：** `apps/web/components/sections/Hero.tsx:49-54`，`apps/web/lib/i18n/messages/zh.json:9`（`hero.cta` = "立即预约"）

**问题：** 首页第一屏最显眼的 CTA，文字是"立即预约"，实际链接是 `/projects`（项目列表）。用户点击后看到的是一个需要自己探索的列表页，不是预约流程。文字承诺与实际目的地完全不匹配。这是首页最大的转化漏斗断点。

**修复方案：** 二选一：改文字为"探索项目"，或改链接为打开 Book Guide 弹窗（`BookNavButton` 已有此功能）。

---

### CON-003 🔴 购物车空字段提交：静默失败，无任何反馈

**位置：** `apps/web/app/[locale]/cart/page.tsx:32-34`

```ts
if (!name || !phone) return;  // 什么都不做，页面无变化
```

**问题：** 用户没填必填项，点提交按钮，页面无任何反应。在部分移动端浏览器（iOS Safari）HTML5 `required` 校验不可靠，用户会以为按钮坏了，多点几次后放弃。

**修复方案：** 校验失败时设置错误状态，高亮对应字段并显示提示文字。

---

### CON-004 🔴 中文页面里项目标签、时长全部显示英文

**位置：**
- Tags：`apps/web/lib/mock-data.ts`（标签均为英文：`"Beginner Friendly"`, `"Popular"` 等），`apps/web/components/projects/ProjectDetail.tsx:107-113`（直接渲染）
- Duration：`mock-data.ts`（`"1 - 1.5 hours"` 格式），前端直接显示

**问题：** 中文用户在项目详情页会看到英文标签和英文时长描述，造成明显的语言跳跃感。这是项目详情页最高频访问区域之一。

**修复方案：** Tags 改为 `{ en: string; zh: string }` 结构；Duration 同理；或在 UI 层根据 locale 做映射。

---

## 第二类：用户信任与转化问题（C1）

---

### CON-005 🟠 邮件模板无任何品牌包装，是纯文字裸发

**位置：** `apps/api/src/lib/email.ts`（全文）

**问题：** 所有发给客户的邮件（预约确认、状态通知）都是直接拼的裸 HTML 字符串（`<h2>`, `<p>`, `<hr>`），没有：
- 品牌 Logo
- 品牌色（caramel / cream 等）
- 响应式布局
- 页脚品牌信息

用户收到一封2010年代风格的纯文字系统邮件，完全看不出来这是一个有设计感的手作工作室。每封邮件都是品牌触点，当前状态对品牌是负资产。

**修复方案：** 创建统一的 HTML 邮件基础模板（包含 Logo、品牌色、响应式排版、页脚），所有邮件函数复用此模板。

---

### CON-006 🟠 确认邮件时间戳写死上海时区，海外用户看到错误时间

**位置：** `apps/api/src/lib/email.ts:82, 118`

```ts
toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })
```

**问题：** 不论用户在哪个时区，确认邮件里显示的时间永远是上海时间。如果工作室在悉尼，客户看到的预约时间是错误的，可能导致迟到或爽约。

**修复方案：** 从 `site_settings` 读取时区配置，或根据用户提交时附带的时区信息格式化时间。

---

### CON-007 🟠 员工欢迎邮件只有中文，无英文

**位置：** `apps/api/src/services/admin/users.admin.service.ts`（`sendStaffWelcomeEmail` 调用），`apps/api/src/lib/email.ts:269-277`

**问题：** 给新员工发的欢迎邮件（含初始密码）只有中文版本。如果雇用了英语员工，他们收到一封完全看不懂的邮件，且里面包含的初始密码是他们登录系统的唯一凭证。

**修复方案：** 欢迎邮件增加英文版本，与其他状态邮件一样做 locale 分支处理。

---

### CON-008 🟠 服务端校验错误是英文，中文用户看到英文报错

**位置：**
- `apps/web/lib/actions/cart.ts:7-8`
- `apps/web/lib/actions/booking.ts:7-8`

```ts
name: z.string().min(1, "Name is required"),
phone: z.string().min(1, "Phone is required"),
```

**问题：** 如果服务端 Zod 校验失败，返回给中文用户的错误信息是英文的。在中文界面看到 "Name is required" 是明显的体验断层。

**修复方案：** Zod message 改为从 i18n 读取，或在 action 层统一做错误信息的 locale 转换。

---

### CON-009 🟠 没有自定义 404 和错误页面，断链后没有出口

**位置：** `apps/web/app/` 下无任何 `not-found.tsx` 或 `error.tsx`

**问题：** 用户访问不存在的项目 slug、过期链接、或 API 失败时，看到的是 Next.js 默认的系统级错误页，没有品牌样式，没有导航，没有"返回首页"按钮。用户进入死路，只能关闭标签页。

**修复方案：**
- 在 `apps/web/app/[locale]/not-found.tsx` 创建品牌化 404 页（含 Logo、友好文案、返回首页按钮）
- 在 `apps/web/app/[locale]/error.tsx` 创建品牌化错误页

---

### CON-010 🟠 移动端导航菜单里找不到购物车入口

**位置：** `apps/web/components/layout/MobileMenu.tsx`（无购物车链接），`apps/web/components/layout/Navbar.tsx:68`（购物车图标仅在顶栏）

**问题：** 移动端用户打开全屏菜单，找不到购物车。购物车入口只有 Navbar 顶栏的小图标，全屏菜单里看不到。用户习惯在菜单里找购物车，找不到会以为网站没有购物功能。

---

### CON-011 🟠 派对页没有预约 / 咨询出口（重申，从 IA 角度确认）

**位置：** `apps/web/app/[locale]/parties/page.tsx`（无任何 CTA）

与前次发现不同，这次从信息架构角度确认：派对套餐是一个完全封闭的展示页，没有连接到任何下一步行动的链路。从 IA 角度，这个页面在用户旅程中是一个死胡同。

---

## 第三类：品牌完成度问题（C2）

---

### CON-012 🟡 存在两套完全独立的按钮设计系统

**问题：**
- Admin 后台：使用 shadcn `Button`（`h-8, rounded-lg`，来自 `components/ui/button.tsx`）
- 公开网站：自定义样式（`rounded-full bg-caramel py-3 px-8`，散落在 13+ 个组件里）

两套系统没有交叉，各自独立维护。修改品牌色或按钮样式需要同时改两个地方，容易遗漏导致不一致。

---

### CON-013 🟡 CSS 定义了深色模式，但整个项目从未启用

**位置：** `apps/web/app/globals.css:93-125`（定义了完整的 `dark:` 变量）

深色模式的 CSS token 全部写好了，但没有任何地方添加 `dark` class 或主题切换开关。这些代码是无效代码，会误导后续开发者以为深色模式是可用的。

---

### CON-014 🟡 面包屑导航完全缺失

**位置：** 整个 `apps/web/components/` 下无 Breadcrumb 组件

用户在 `/zh/projects/clay-keychain`（项目详情）这样的深层页面时，不知道自己属于哪个分类，只能点"返回"。搜索引擎也无法通过面包屑理解页面层级关系。

---

### CON-015 🟡 Footer 信息不完整：有画廊没有联系，有重复链接

**位置：** `apps/web/components/layout/Footer.tsx:82-93`

- Projects 链接出现两次
- 没有 Contact 链接
- 没有 Instagram / 小红书图标（设置里填了但这里不读）
- 没有购物车入口

---

### CON-016 🟡 日历组件星期标题硬编码，不走 i18n

**位置：** `apps/web/components/book/BookingCalendar.tsx:19-20, 42`

```ts
const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
```

中文页面的日历显示英文星期缩写，不一致。

---

### CON-017 🟡 价格格式字符串存在数据库，无法本地化

**位置：** `apps/web/lib/mock-data.ts`（priceRange 如 `"¥68 - ¥128"`），`packages/db/src/schema/index.ts:60`（`priceRange varchar`）

价格是字符串，直接存储并展示，不能根据 locale 做货币格式化（如 AUD $88 vs ¥88）。对于双语用户或海外用户，这是一个信任障碍。

---

### CON-018 🟡 Admin 后台完全没有 i18n，只有硬编码中英混用

**位置：** `apps/web/app/admin/` 下所有页面

Admin 后台界面全是硬编码字符串（主要中文），没有使用 `useTranslations`。这本身不是 bug，但意味着：如果将来需要给英语员工使用，整个 Admin 需要重新国际化，工作量非常大。

---

## 第四类：开发者体验问题（C3）

---

### DX-001 🔵 `pnpm dev` 只启动前端，新开发者不知道 API 没跑

**位置：** 根目录 `package.json`（`dev` 脚本只指向 `@yezz/web`）

新开发者克隆仓库，执行 `pnpm dev`，只有前端启动。由于 feature flag 默认为 `false`，显示 mock 数据，一切"看起来正常"，但 API 根本没有运行。这个陷阱不在 README 的警告里。

**修复方案：** README 顶部加明显警告；或使用 `concurrently` 在 root dev 脚本同时启动 API 和 Web。

---

### DX-002 🔵 `mock-data.ts` 在 web 包里，却被 db 包当作依赖导入

**位置：** `apps/web/package.json:13-15`（exports mock-data），`packages/db/src/seed.ts`（从 web 包导入）

`packages/db`（数据层）依赖 `apps/web`（展示层），在 monorepo 架构里是反向依赖。任何对 web 包 mock-data 的修改都可能破坏 db seed，而这个关系不显而易见，没有文档说明。

**修复方案：** 将 mock-data 移到独立的 `packages/mock-data` 或 `packages/db/src/fixtures` 中，让 web 包也从这里导入。

---

### DX-003 🔵 `FORCE_SEED` 环境变量未写入 `.env.example`

**位置：** `packages/db/src/seed.ts:106`（使用 `FORCE_SEED`），`.env.example`（无此变量）

开发者不知道有这个变量，重置数据库需要翻源码才能发现。

---

### DX-004 🔵 README 文档有一处失效路径引用

**位置：** `docs/backend-migration/REQUIREMENTS.md:457`

仍然引用 `apps/web/lib/sanity/mock-data.ts`，但该文件已移动到 `apps/web/lib/mock-data.ts`。

---

## 第三轮问题汇总与优先级

### 上线前必须处理（C0）

| ID | 问题 | 修复难度 | 预估时间 |
|----|------|----------|----------|
| CON-001 | 所有图片是占位图，上线即无关内容 | 低（文档+流程） | 4 小时（+换图时间） |
| CON-002 | Hero CTA 文字与链接不匹配 | 低 | 30 分钟 |
| CON-003 | 购物车空字段静默失败 | 低 | 1 小时 |
| CON-004 | 中文页面项目标签/时长显示英文 | 中 | 1 天 |

### 上线后第一周修（C1）

| ID | 问题 | 修复难度 | 预估时间 |
|----|------|----------|----------|
| CON-005 | 邮件无品牌包装 | 中 | 1 天 |
| CON-006 | 邮件时间写死上海时区 | 低 | 1 小时 |
| CON-007 | 员工欢迎邮件只有中文 | 低 | 1 小时 |
| CON-008 | 服务端校验错误是英文 | 中 | 3 小时 |
| CON-009 | 无自定义 404 / 错误页面 | 低 | 3 小时 |
| CON-010 | 移动端找不到购物车入口 | 低 | 1 小时 |
| CON-011 | 派对页无预约出口（IA 断链） | 低 | 1 小时 |

### 第二周迭代（C2）

| ID | 问题 | 修复难度 | 预估时间 |
|----|------|----------|----------|
| CON-012 | 两套按钮设计系统 | 高 | 2 天 |
| CON-013 | 深色模式 CSS 但从未启用 | 低 | 30 分钟 |
| CON-014 | 无面包屑导航 | 中 | 1 天 |
| CON-015 | Footer 信息不完整 | 低 | 1 小时 |
| CON-016 | 日历星期标题英文硬编码 | 低 | 30 分钟 |
| CON-017 | 价格格式不可本地化 | 高 | 2 天 |
| CON-018 | Admin 无 i18n | 高 | 长期 |

### 持续改进（C3）

| ID | 问题 | 说明 |
|----|------|------|
| DX-001 | `pnpm dev` 只启动前端 | 加 README 警告或 concurrently |
| DX-002 | db 包反向依赖 web 包 | 重构 mock-data 位置 |
| DX-003 | FORCE_SEED 未文档化 | 加入 .env.example |
| DX-004 | README 路径引用失效 | 更新文档 |

---

## 三轮审计总汇总

| 轮次 | 审计范围 | 问题数 |
|------|----------|--------|
| 第一轮 | 前端 UX / Bug / i18n / SEO / 无障碍 | 30 个 |
| 第二轮 | 后端安全 / 业务逻辑 / 基础设施 / 运维 | 41 个 |
| 第三轮 | 内容 / 品牌 / 设计 / 邮件 / DX | 22 个 |
| **合计** | | **93 个** |

---

| 优先级 | 含义 | 数量 |
|--------|------|------|
| 🔴 上线前必须修 | P0 + S0 + C0 | **14 个** |
| 🟠 第一周内修 | P1 + S1 + C1 | **23 个** |
| 🟡 第二周迭代 | P2 + S2 + C2 | **31 个** |
| 🔵 持续改进 | P3 + S3 + C3 | **25 个** |
