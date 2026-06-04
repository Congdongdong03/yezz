# YEZZ 商业化路线图

> **定位：** 将 YEZZ 从"展示型静态网站"升级为"能独立运转的商业系统"  
> **目标：** 用户从浏览 → 预约 → 确认 → 到店 → 传播，全链路无需人工介入  
> **评估基准日期：** 2026-06-04

---

## 优先级说明

| 标记 | 含义 |
|------|------|
| 🔴 **Critical** | 没有会直接导致商业损失或安全事故，上线前必须完成 |
| 🟠 **High** | 闭合核心商业循环，完成后网站才能"独立运转" |
| 🟡 **Medium** | 提升运营效率和用户体验，团队扩张后明显需要 |
| 🟢 **Growth** | 增长飞轮，拉开与同类网站的差距 |

---

## 阶段一：修复基础体验 Phase A

> **目标：** 消除上线前的致命缺陷  
> **预估工期：** 1～2 周

---

### A-001 🔴 客户确认邮件

**问题：** 用户提交预约或购物车订单后，收不到任何回执。用户不知道"有没有人收到"，造成焦虑、重复提交和客服压力。

**方案：**

- `POST /api/v1/bookings` 落库成功后，给客户邮箱发确认邮件
- `POST /api/v1/cart-orders` 落库成功后，给客户邮箱发确认邮件
- 邮件内容：
  - 订单号（`booking-YYYYMMDD-XXXX` 格式）
  - 所选项目/风格/日期/人数摘要
  - 提交时间
  - "我们将在 24 小时内与您联系" 承诺语
  - 店铺联系方式（电话、微信）

**涉及文件：**
- `apps/api/src/lib/email.ts` — 新增 `sendBookingConfirmationToCustomer()`、`sendOrderConfirmationToCustomer()`
- `apps/api/src/routes/v1/bookings.ts` — 调用上述函数
- `apps/api/src/routes/v1/cart-orders.ts` — 调用上述函数

**验收标准：**
- 提交预约 → 客户邮箱收到确认邮件，包含正确的订单摘要
- 提交购物车订单 → 客户邮箱收到确认邮件
- Resend 发送失败不阻断落库（已有逻辑保持不变）

---

### A-002 🔴 Admin JWT 改用 httpOnly Cookie

**问题：** Admin 登录后 JWT 存储在 `localStorage`，容易被 XSS 攻击窃取，一旦泄露攻击者可以完整控制后台。

**方案：**

- 登录接口 `POST /api/v1/auth/login` 在响应头写 `Set-Cookie: token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/admin`
- 前端 Admin `lib/admin/api.ts` 移除手动拼 `Authorization: Bearer` header，改为依赖浏览器自动携带 cookie
- 新增 `POST /api/v1/auth/logout` 接口，清除 cookie
- Fastify 鉴权插件改为从 cookie 读 token（`@fastify/cookie`）

**涉及文件：**
- `apps/api/src/plugins/auth.ts`
- `apps/api/src/routes/v1/auth.ts`
- `apps/web/app/admin/` 下所有 Admin 页面的 fetch 调用
- `apps/web/lib/admin/api.ts`

**验收标准：**
- 登录后浏览器 DevTools Application → Cookies 中可见 `token`，且 `HttpOnly` 为 true
- `localStorage` 中不再存储任何 token
- 刷新页面保持登录状态
- 点击退出登录后 cookie 被清除，访问 Admin 页面跳转到登录页

---

### A-003 🔴 Feature Flag 默认值修正

**问题：** `.env.example` 中 `NEXT_PUBLIC_USE_API=false`，所有新开发者启动后看到的是 mock 假数据，容易造成混淆和误判。

**方案：**

- `.env.example` 中 `NEXT_PUBLIC_USE_API` 改为 `true`
- `README.md` 顶部加醒目警告：启动前需要 API 服务运行
- `apps/web/lib/api/config.ts` 中当 `USE_API=false` 且 `NODE_ENV=production` 时，抛出构建警告

**涉及文件：**
- `.env.example`
- `README.md`
- `apps/web/lib/api/config.ts`

**验收标准：**
- 新克隆仓库按 README 启动后，看到的是真实数据库内容

---

### A-004 🔴 统一预约入口，消除双路径歧义

**问题：** 存在 `/book`（预约表单）和 `/cart`（购物车结单）两套并行流程，用户不清楚该走哪条路。

**方案：**

根据 `project_type` 区分：

| 类型 | 用户路径 | 提交接口 |
|------|----------|----------|
| `experience`（体验） | 项目详情页 → 直接选日期/人数 → 提交预约 | `POST /api/v1/bookings` |
| `product`（产品） | 项目详情页 → 选风格加购 → 购物车页 → 填联系方式 → 提交 | `POST /api/v1/cart-orders` |

- 删除独立的 `/book` 页面，将预约表单内嵌到 `experience` 类型的项目详情页
- `/cart` 页面保留，但入口只来自 `product` 类型
- Navbar 的"预约"按钮改为：点击后根据当前浏览的项目类型路由，无上下文则弹出引导选择

**涉及文件：**
- `apps/web/app/[locale]/book/page.tsx` — 考虑删除或重定向
- `apps/web/app/[locale]/projects/[slug]/page.tsx` — 内嵌 BookingForm（experience 类型）
- `apps/web/components/book/BookingForm.tsx` — 抽出为可复用组件
- `apps/web/components/layout/Navbar.tsx` — 修改预约按钮逻辑

**验收标准：**
- Experience 类型项目：详情页底部显示日期+人数选择+提交，无需跳转其他页面
- Product 类型项目：加入购物车后，购物车页填联系方式提交
- 用户不会面对"预约还是购物车"的选择困境

---

### A-005 🟠 价格体系规范化

**问题：** `diy_projects.price_range` 是随意字符串（如 `"¥88-128"`），`project_styles.price` 是数字，两者格式不一致，没有货币单位，国际用户无法理解。

**方案：**

数据库 schema 变更（新增迁移）：

```sql
ALTER TABLE diy_projects
  ADD COLUMN price_min INTEGER,      -- 分为单位，或直接元
  ADD COLUMN price_max INTEGER,
  ADD COLUMN price_currency VARCHAR(10) DEFAULT 'CNY';
-- 保留 price_range 字段作为显示用覆盖（可选）
```

API 响应新增字段：

```json
{
  "priceMin": 88,
  "priceMax": 128,
  "priceCurrency": "CNY",
  "priceDisplay": "¥88 - ¥128"   // 后端格式化，前端直接显示
}
```

**涉及文件：**
- `packages/db/src/schema/index.ts`
- `packages/db/migrations/`（新增迁移文件）
- `apps/api/src/services/projects.ts`
- `apps/web/components/projects/` 相关展示组件

**验收标准：**
- 项目详情页显示格式统一的价格（如 `¥88 - ¥128`）
- 购物车中风格价格与详情页一致，有货币单位

---

## 阶段二：闭合商业循环 Phase B

> **目标：** 完成后网站真正"能独立运转"  
> **预估工期：** 4～6 周

---

### B-001 🟠 档期管理系统（Availability Calendar）

**问题：** 预约系统没有档期管理。用户选日期时不知道哪天有空位，管理员不知道哪天被订满，本质上只是一个带日期字段的联系表单。

**数据库设计：**

```sql
-- 管理员设置的可用时段
CREATE TABLE time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  start_time TIME NOT NULL,     -- 如 '10:00'
  end_time TIME NOT NULL,       -- 如 '12:00'
  capacity INTEGER NOT NULL,    -- 最大接待人数
  booked_count INTEGER NOT NULL DEFAULT 0,
  category_id UUID REFERENCES project_categories(id),  -- NULL = 全类型可用
  is_available BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,                   -- 管理员备注（如"特殊活动"）
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 预约记录关联时段
ALTER TABLE bookings ADD COLUMN time_slot_id UUID REFERENCES time_slots(id);
```

**API 新增：**

```
公开：
GET  /api/v1/time-slots?year=2026&month=06         # 返回某月可用日期列表
GET  /api/v1/time-slots?date=2026-06-15            # 返回某天可用时段（含剩余容量）

Admin（JWT）：
GET    /api/v1/admin/time-slots
POST   /api/v1/admin/time-slots                    # 创建时段（支持批量/循环）
PATCH  /api/v1/admin/time-slots/:id                # 修改/关闭时段
DELETE /api/v1/admin/time-slots/:id

预约时联动：
POST /api/v1/bookings 时，校验 time_slot_id 仍有容量，原子性 booked_count +1
```

**Admin UI：**

- `/admin/time-slots` — 月视图日历组件（推荐 `react-big-calendar` 或自建简版）
- 点击某天 → 弹出时段列表，可新增/编辑/关闭
- 批量创建：选择日期范围 + 星期几 + 时段模板（例如"每周三、六 10:00-12:00, 14:00-16:00"）

**前端用户侧：**

- 预约日历改为：灰色 = 无档期，绿色 = 有档期，红色 = 已满
- 选择日期后，展示当天可用时段列表（含剩余名额提示，如"仅剩 2 位"）
- 时段剩余 ≤ 20% 时显示"即将满额"徽标

**涉及文件：**
- `packages/db/src/schema/index.ts`
- `packages/db/migrations/`（新增迁移）
- `apps/api/src/routes/v1/time-slots.ts`（新建）
- `apps/api/src/services/time-slots.ts`（新建）
- `apps/api/src/repositories/time-slots.ts`（新建）
- `apps/web/components/book/BookingCalendar.tsx`（新建）
- `apps/web/app/admin/time-slots/page.tsx`（新建）

**验收标准：**
- 用户只能选择管理员设置的可用时段
- 预约成功后对应时段 `booked_count` 正确 +1
- 时段满员后，该时段对用户不可选
- 管理员可在 Admin 中关闭某个时段（已有预约不影响）

---

### B-002 🟠 订单状态变更 → 自动通知客户

**问题：** 管理员在 Admin 后台确认/拒绝预约时，客户不知道结果。客户必须主动联系，运营摩擦极高。

**方案：**

Admin 在 `PATCH /api/v1/admin/bookings/:id` 修改 `status` 时，自动触发邮件：

| 状态变更 | 给客户发的内容 |
|----------|---------------|
| `new → contacted` | "我们已查看您的预约，稍后将联系您确认细节" |
| `new/contacted → confirmed` | "您的预约已确认！时间：XX，地址：XX，注意事项：XX" |
| `any → cancelled` | "很遗憾，您的预约无法安排，原因：[管理员填写]" |

- Admin 确认/取消时弹出输入框，可填写给客户的备注（可选）
- 邮件模板支持中英双语（根据原始预约的 locale 决定）

**涉及文件：**
- `apps/api/src/lib/email.ts` — 新增状态通知模板函数
- `apps/api/src/routes/v1/admin/bookings.ts` — PATCH 触发邮件
- `apps/web/app/admin/bookings/page.tsx` — 状态更新时显示备注输入框

**验收标准：**
- Admin 将预约状态改为 `confirmed` → 客户邮箱收到确认邮件，含时间和地址
- Admin 将预约状态改为 `cancelled` → 客户邮箱收到取消通知

---

### B-003 🟡 Admin 实时通知（未读角标）

**问题：** 新订单进来只发邮件通知店主，Admin 界面没有任何视觉提示，店主必须手动刷新查看。

**方案（轻量 polling，无需 WebSocket）：**

```sql
ALTER TABLE bookings ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE cart_orders ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false;
```

```
GET /api/v1/admin/notifications/unread-count
→ { "bookings": 3, "orders": 1, "total": 4 }
```

- Admin Layout 组件每 30 秒 polling 一次 unread-count
- Sidebar 中"预约"和"订单"菜单项旁显示角标数字（≤99，超出显示 99+）
- 进入列表页后，自动调用 `PATCH /api/v1/admin/notifications/mark-read?type=bookings` 清零

**涉及文件：**
- `packages/db/migrations/`
- `apps/api/src/routes/v1/admin/notifications.ts`（新建）
- `apps/web/app/admin/AdminShell.tsx` — 加入 polling 逻辑
- `apps/web/components/admin/Sidebar.tsx` — 显示角标

**验收标准：**
- 新预约进来 → 最多 30 秒内 Admin Sidebar 出现角标
- 进入预约列表页 → 角标消失

---

### B-004 🟡 Admin 多角色权限

**问题：** 只有一个 `admin` 角色，无法给前台员工创建独立账号，所有人共用一个密码，既不安全也不可追溯。

**方案：**

扩展 `user_role` enum：

```sql
ALTER TYPE user_role ADD VALUE 'staff';
```

权限矩阵：

| 功能 | admin | staff |
|------|-------|-------|
| 查看/管理预约&订单 | ✅ | ✅ |
| 编辑项目/分类/派对/画廊 | ✅ | ❌ |
| 修改站点设置 | ✅ | ❌ |
| 管理用户账号 | ✅ | ❌ |
| 媒体上传 | ✅ | ✅ |

- Admin `/admin/users` 新增用户管理页（仅 admin 角色可访问）
- 创建用户时设定 role，生成初始密码并通过邮件发送
- API 鉴权中间件按 role 做路由级保护

**涉及文件：**
- `packages/db/migrations/`
- `apps/api/src/plugins/auth.ts` — 新增 `requireRole()` 中间件
- `apps/api/src/routes/v1/admin/users.ts`（新建）
- `apps/web/app/admin/users/page.tsx`（新建）

**验收标准：**
- staff 账号登录后，Sidebar 中不显示内容管理菜单
- staff 直接访问 `/admin/projects` → 重定向或显示 403

---

### B-005 🟡 购物车持久化

**问题：** 购物车只存 `localStorage`，换浏览器/清缓存/隐私模式全部丢失，对于需要花时间选风格的用户是明显流失点。

**方案（无账号轻量版）：**

- 用户第一次添加购物车时，生成一个 `cart_session_id`（UUID），存入 cookie（非 httpOnly，7 天有效）
- 购物车数据同步存到服务端：

```sql
CREATE TABLE cart_sessions (
  id UUID PRIMARY KEY,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP NOT NULL    -- 7 天后过期
);
```

- `GET /api/v1/cart/:session_id` — 恢复购物车
- `PUT /api/v1/cart/:session_id` — 更新购物车
- 每周定时清理过期 session

**涉及文件：**
- `packages/db/migrations/`
- `apps/api/src/routes/v1/cart.ts`（新建）
- `apps/web/lib/cart/context.tsx` — 改为混合模式（本地 + 服务端同步）

**验收标准：**
- 用户在手机加了购物车，换用电脑打开同一浏览器 cookie 的网站，购物车内容保留
- 7 天后 session 过期，购物车自动清空

---

## 阶段三：增长飞轮 Phase C

> **目标：** 构建低成本可持续增长机制  
> **预估工期：** 持续迭代

---

### C-001 🟢 数据分析埋点

**问题：** 没有任何用户行为数据，无法判断哪些项目受欢迎、用户在哪里流失、哪个渠道带来转化。

**方案：**

接入 **Google Analytics 4**（免费），在以下关键节点触发自定义事件：

```typescript
// 关键事件列表
ga4.track('view_project', { project_slug, project_name, category })
ga4.track('add_to_cart', { project_slug, style_name, price })
ga4.track('begin_checkout', { item_count, total_value })
ga4.track('submit_booking', { project_slug, date, people_count })
ga4.track('submit_cart_order', { item_count })
```

同时在 API 层记录轻量业务数据（不依赖第三方）：

```sql
CREATE TABLE analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  project_id UUID REFERENCES diy_projects(id),
  created_at TIMESTAMP DEFAULT now()
);
```

Admin 看板新增：本周热门项目浏览量 Top 5、本月预约转化率。

**涉及文件：**
- `apps/web/app/layout.tsx` — 接入 GA4 Script
- `apps/web/lib/analytics.ts`（新建）— 封装 event tracking
- 各关键组件中调用 analytics 函数
- `packages/db/migrations/`
- `apps/api/src/routes/v1/admin/analytics.ts`（新建）
- `apps/web/app/admin/page.tsx` — 看板添加数据图表

---

### C-002 🟢 学员作品 UGC 系统

**问题：** 画廊完全由管理员上传，没有用户内容，可信度低，更新成本高。

**方案：**

在订单状态变更为 `confirmed` 的确认邮件中，附带一个 **一次性上传链接**：

```
https://yezz.com/upload/share?token=<signed_jwt_1h_ttl>
```

上传页面：

- 允许上传 1~5 张图片（MinIO/R2）
- 填写昵称（可选）和一句话感受（可选）
- 提交后进入 **待审核** 状态

```sql
ALTER TABLE gallery_images
  ADD COLUMN source VARCHAR(20) DEFAULT 'admin',   -- 'admin' | 'user'
  ADD COLUMN booking_id UUID REFERENCES bookings(id),
  ADD COLUMN uploader_nickname VARCHAR(100),
  ADD COLUMN uploader_comment TEXT,
  ADD COLUMN status VARCHAR(20) DEFAULT 'approved'; -- 'pending' | 'approved' | 'rejected'
```

Admin 新增审核页 `/admin/gallery/pending`：一键通过/拒绝，通过后自动出现在画廊。
前端画廊新增"学员作品"标签，展示昵称和感受。

---

### C-003 🟢 Magic Link 订单追踪（轻量客户账号）

**问题：** 用户提交订单后，无法主动查询状态，只能等待邮件通知，被动体验差。

**方案：**

无需注册，通过邮件 magic link 查看：

1. 订单确认邮件中附带链接：`https://yezz.com/my-order?token=<signed_jwt>`
2. 点击链接进入只读订单详情页，展示：当前状态、预约时间、项目信息、店铺联系方式
3. Token 有效期 30 天，每次发确认邮件时刷新

```typescript
// Token payload
{
  type: 'order_view',
  orderId: string,
  orderType: 'booking' | 'cart_order',
  exp: number  // 30天
}
```

**涉及文件：**
- `apps/api/src/lib/auth.ts` — 新增 `signOrderViewToken()`
- `apps/api/src/routes/v1/orders/view.ts`（新建）— 公开接口，token 鉴权
- `apps/web/app/[locale]/my-order/page.tsx`（新建）

---

### C-004 🟢 微信公众号通知（国内用户触达）

**问题：** Resend 邮件对国内用户打开率极低（往往进垃圾箱），而微信通知打开率接近 100%。

**方案：**

接入 **微信公众号模板消息**（需认证服务号）：

- 用户预约时可选择：邮件通知 or 微信通知（扫码关注公众号后绑定 openid）
- 状态变更时通过微信模板消息推送，内容与邮件一致

```sql
ALTER TABLE bookings
  ADD COLUMN wechat_openid VARCHAR(100),
  ADD COLUMN notification_channel VARCHAR(20) DEFAULT 'email'; -- 'email' | 'wechat' | 'both'
```

此功能依赖微信认证服务号（个人号不支持模板消息），需要营业执照。

---

### C-005 🟢 SEO 优化

**问题：** 当前网站没有结构化数据，项目页、派对页缺少 meta 标签动态生成，搜索引擎收录质量差。

**方案：**

- 每个项目详情页自动生成 `<title>`、`<meta description>`（来自 `project.description.zh/en`）
- 添加 JSON-LD Schema Markup：

```json
{
  "@type": "LocalBusiness",
  "name": "YEZZ Studio",
  "priceRange": "¥88-¥300",
  "openingHours": "...",
  "hasOfferCatalog": { ... }
}
```

- 站点地图 `sitemap.xml` 自动生成（项目、派对、画廊页面）
- `robots.txt` 正确配置（排除 `/admin`）

---

## 总览甘特图（参考）

```
Week 1-2:   [A-001] 客户确认邮件
            [A-002] JWT Cookie 安全修复
            [A-003] Feature Flag 默认值
            [A-004] 统一预约入口

Week 3:     [A-005] 价格规范化

Week 4-6:   [B-001] 档期管理系统（最复杂，核心功能）

Week 7:     [B-002] 订单状态通知客户
            [B-003] Admin 未读角标

Week 8:     [B-004] Admin 多角色
            [B-005] 购物车持久化

Week 9+:    [C-001] GA4 埋点
            [C-002] UGC 作品系统
            [C-003] Magic Link 订单追踪
            [C-004] 微信公众号通知
            [C-005] SEO 优化
```

---

## 需求 ID 索引

| ID | 标题 | 优先级 | 阶段 |
|----|------|--------|------|
| A-001 | 客户确认邮件 | 🔴 Critical | Phase A |
| A-002 | Admin JWT 改 httpOnly Cookie | 🔴 Critical | Phase A |
| A-003 | Feature Flag 默认值修正 | 🔴 Critical | Phase A |
| A-004 | 统一预约入口 | 🔴 Critical | Phase A |
| A-005 | 价格体系规范化 | 🟠 High | Phase A |
| B-001 | 档期管理系统 | 🟠 High | Phase B |
| B-002 | 订单状态变更通知客户 | 🟠 High | Phase B |
| B-003 | Admin 实时通知角标 | 🟡 Medium | Phase B |
| B-004 | Admin 多角色权限 | 🟡 Medium | Phase B |
| B-005 | 购物车持久化 | 🟡 Medium | Phase B |
| C-001 | GA4 数据分析埋点 | 🟢 Growth | Phase C |
| C-002 | 学员作品 UGC 系统 | 🟢 Growth | Phase C |
| C-003 | Magic Link 订单追踪 | 🟢 Growth | Phase C |
| C-004 | 微信公众号通知 | 🟢 Growth | Phase C |
| C-005 | SEO 优化 | 🟢 Growth | Phase C |

---

> **建议启动顺序：** A-001 → A-002 → A-003 → A-004 → B-001 → B-002  
> 完成 A 阶段即可上线；完成 B 阶段后，网站真正能独立运转，无需人工干预日常订单流程。
