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

> **结论：** P0 的 4 个 bug（BUG-001~004）任意一个上线都会让用户直接体验到坏掉的功能，建议上线前全部修完。P1 的 8 个问题直接影响转化，建议发布后第一周内修复。
