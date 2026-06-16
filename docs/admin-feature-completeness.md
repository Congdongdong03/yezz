# Admin 系统功能完整度清单

> 生成时间: 2026-06-16
> 本清单包含 **Bug 修复** + **功能补全** + **体验优化** 三大类，共 28 项任务
> 按模块分组，每组内按优先级排序

---

## 总体排期建议

| 阶段 | 目标 | 预估工期 |
|------|------|----------|
| Phase 1 | 修 Bug（P0 + P1） | 0.5 ~ 1 天 |
| Phase 2 | 补齐核心功能缺口 | 2 ~ 3 天 |
| Phase 3 | 体验优化 + 标准后台功能 | 视需求决定 |

---

# 🔴 Phase 1：Bug 修复（必须先修）

## B1 — Cookie maxAge 单位错误导致频繁登出

- **严重等级**: P0 🔴
- **文件**: `apps/api/src/routes/v1/auth.routes.ts:21`
- **问题**: `maxAge: 60 * 60 * 24`（86400）单位是毫秒，实际只有 86.4 秒
- **修复**: 改为 `60 * 60 * 24 * 1000`（24 小时）
- **验证**: 登录后在浏览器 DevTools → Cookies 中确认 `token` 的 Max-Age ≈ 86400 秒
- **预估**: 5 min

---

## B2 — `initialPassword` 未返回给前端

- **严重等级**: P0 🔴
- **文件**: `apps/api/src/services/admin/users.admin.service.ts:44,79`
- **问题**: `create` 方法返回类型只有 `{ user: AdminUserDto }`，但 `initialPassword` 变量计算后没返回
- **修复**:
  1. 返回类型改为 `Promise<{ user: AdminUserDto; initialPassword: string }>`
  2. `return` 语句加上 `initialPassword`
- **验证**: 创建用户后页面正确显示"初始密码：xxxx"
- **预估**: 10 min

---

## B3 — `ProjectForm` 缺少 `useRouter` 导入

- **严重等级**: P0 🔴
- **文件**: `apps/web/components/admin/ProjectForm.tsx:297`
- **问题**: 使用了 `router.back()` 但没有 `import { useRouter } from "next/navigation"`
- **修复**:
  1. 顶部添加 `import { useRouter } from "next/navigation";`
  2. 组件内添加 `const router = useRouter();`
- **验证**: 编辑 Project → 点击"取消" → 正常返回
- **预估**: 5 min

---

## B4 — `NaN` 参数未处理导致 API 500

- **严重等级**: P0 🔴
- **文件**:
  - `apps/api/src/routes/v1/admin/bookings.routes.ts:8-9`
  - `apps/api/src/routes/v1/admin/projects.routes.ts:10-11`
  - `apps/api/src/routes/v1/admin/time-slots.routes.ts`
- **问题**: `Number("abc")` = `NaN`，传入后 `Math.max(1, NaN)` = `NaN`，导致 SQL `OFFSET NaN` 报错
- **修复**:
  1. 新建工具函数 `parsePositiveInt(value, fallback)`，处理 `NaN` 和负数
  2. 替换所有路由中的 `Number()` 转换
  3. `time-slots` 的 `capacity` 也要处理
- **验证**: `GET /admin/bookings?page=abc` → 正常返回，不抛 500
- **预估**: 30 min

---

## B5 — Cart Orders 状态流转缺少校验

- **严重等级**: P1 🟡
- **文件**: `apps/api/src/services/admin/cart-orders.admin.service.ts:93-104`
- **问题**: Bookings 有 `VALID_TRANSITIONS` 严格校验，但 Cart Orders 完全没有，可以任意跳转状态
- **修复**:
  1. 在 `cart-orders.admin.service.ts` 中定义自己的 `VALID_TRANSITIONS`（或复用 bookings 的）
  2. `updateStatus` 中调用 `validateStatusTransition`
- **预估**: 15 min

---

## B6 — Admin API 缺少 Rate Limiting

- **严重等级**: P1 🟡
- **文件**: `apps/api/src/routes/v1/admin/` 下所有路由
- **问题**: 除 login 外，所有 admin 接口无限速，存在 DoS / 刷存储风险
- **修复方案**（二选一）：
  - **方案 A（轻量）**: 基于现有 `checkRateLimit` 实现一个 Fastify `onRequest` hook
  - **方案 B（标准）**: 引入 `@fastify/rate-limit`
- **建议限速策略**:
  | 路由 | 限制 | 窗口 |
  |------|------|------|
  | `POST /upload` | 50 | 1h |
  | 其他写操作 | 200 | 1h |
  | 读操作 | 300 | 1h |
- **预估**: 1.5 ~ 2 h

---

# 🟡 Phase 2：核心功能补全

## F1 — Categories 新建功能

- **优先级**: 高
- **现状**: 只能编辑现有分类，不能新建
- **缺失**:
  - ❌ 后端路由: 没有 `POST /api/v1/admin/categories`
  - ❌ 前端 API: 没有 `createCategory()` 函数
  - ❌ 前端 UI: 没有"新建分类"按钮和表单
- **涉及文件**:
  - 后端: `apps/api/src/routes/v1/admin/categories.routes.ts`
  - 后端: `apps/api/src/services/admin/categories.admin.service.ts`
  - 前端: `apps/web/lib/admin/api.ts`
  - 前端: `apps/web/app/admin/categories/page.tsx`
- **实现建议**:
  1. 后端 `categories.admin.service.ts` 新增 `create(input)` 方法
  2. 后端 `categories.routes.ts` 新增 `POST /`
  3. 前端 `api.ts` 新增 `createCategory(data)`
  4. 前端 `categories/page.tsx` 顶部加"新建分类"按钮，展开表单（或 inline 添加最后一行）
- **预估**: 40 min

---

## F2 — Categories 删除功能

- **优先级**: 高
- **现状**: 不能删除分类
- **缺失**:
  - ❌ 后端路由: 没有 `DELETE /api/v1/admin/categories/:id`
  - ❌ 前端 API: 没有 `deleteCategory()` 函数
  - ❌ 前端 UI: 没有"删除"按钮
- **涉及文件**: 同 F1
- **注意点**: 删除前检查该分类下是否有关联的 Project，如果有应拒绝删除或提示
- **预估**: 25 min

---

## F3 — Users 编辑功能

- **优先级**: 高
- **现状**: 只能创建和删除，不能修改用户信息
- **缺失**:
  - ❌ 后端路由: 没有 `PATCH /api/v1/admin/users/:id`
  - ❌ 前端 API: 没有 `updateAdminUser()` 函数
  - ❌ 前端 UI: 没有"编辑"入口
- **涉及文件**:
  - 后端: `apps/api/src/routes/v1/admin/users.routes.ts`
  - 后端: `apps/api/src/services/admin/users.admin.service.ts`
  - 前端: `apps/web/lib/admin/api.ts`
  - 前端: `apps/web/app/admin/users/page.tsx`
- **可编辑字段**: `name`, `email`, `role`
- **预估**: 35 min

---

## F4 — Users 重置密码功能

- **优先级**: 高
- **现状**: 用户忘了密码只能删了重建
- **缺失**:
  - ❌ 后端路由: 没有 `POST /api/v1/admin/users/:id/reset-password`
  - ❌ 前端 API: 没有 `resetAdminUserPassword()` 函数
  - ❌ 前端 UI: 没有"重置密码"按钮
- **实现建议**:
  1. 后端生成新密码 → bcrypt hash → 更新数据库 → 返回明文新密码
  2. 前端弹出 AlertBanner 显示新密码，并尝试发邮件
  3. 参考 `create` 中的邮件发送逻辑
- **预估**: 30 min

---

## F5 — Bookings 详情页

- **优先级**: 中
- **现状**: 列表页把所有字段挤在表格里，信息太多；后端有 `GET /:id` 但前端没调用
- **缺失**:
  - ❌ 前端 API: 没有 `getAdminBooking(id)` 函数（虽然后端接口存在）
  - ❌ 前端页面: 没有 `/admin/bookings/[id]/page.tsx`
  - ❌ 前端列表: 没有"查看详情"入口
- **涉及文件**:
  - 前端: `apps/web/lib/admin/api.ts`
  - 前端: 新建 `apps/web/app/admin/bookings/[id]/page.tsx`
  - 前端: `apps/web/app/admin/bookings/page.tsx`（加链接）
- **详情页应展示**: 客户信息、意向项目、时段信息、完整备注、状态变更历史（如有）
- **预估**: 45 min

---

## F6 — Orders 详情页

- **优先级**: 中
- **现状**: 同 Bookings，后端有 `GET /:id` 但前端没调用
- **缺失**:
  - ❌ 前端 API: 没有 `getAdminOrder(id)` 函数
  - ❌ 前端页面: 没有 `/admin/orders/[id]/page.tsx`
- **预估**: 40 min

---

## F7 — TimeSlots 完整编辑功能

- **优先级**: 中
- **现状**: 只能开关可用性和删除，不能改时间/容量/备注/分类
- **缺失**:
  - ❌ 前端 UI: 没有编辑时段的表单或 Modal
- **涉及文件**: `apps/web/app/admin/time-slots/page.tsx`
- **实现建议**:
  1. 在每条 time-slot 右侧加"编辑"按钮
  2. 弹出 Modal 或展开 inline 编辑表单
  3. 可修改: `date`, `startTime`, `endTime`, `capacity`, `categoryId`, `notes`
  4. 调用已有的 `updateAdminTimeSlot(id, data)` API
- **注意**: 如果该时段已有预约（`bookedCount > 0`），修改容量时应提示或限制
- **预估**: 50 min

---

## F8 — PartyForm 补充 `imageUrls` 多图上传

- **优先级**: 中
- **现状**: 类型定义有 `imageUrls: string[]`，但 UI 只有单图 `coverImageUrl`
- **缺失**:
  - ❌ UI: 没有多图上传/管理区域
- **涉及文件**:
  - `apps/web/components/admin/PartyForm.tsx`
  - `apps/web/lib/admin/types.ts`（确认类型）
- **实现建议**:
  1. 参考 ProjectForm 的 "图集 Images" 区域，用同样的模式实现多图上传
  2. 每张图可上传 + 删除 + 排序
- **预估**: 30 min

---

## F9 — Projects 页面接入图片上传

- **优先级**: 低
- **现状**: [projects/new/page.tsx:23](apps/web/app/admin/projects/new/page.tsx#L23) 写着"图片请填写 URL（P1 无上传）"
- **问题**: `ImageUploadField` 组件其实已经完全可用了，只是没接
- **修复**:
  1. `ProjectForm.tsx` 中 `coverImageUrl` 字段的输入框换成 `ImageUploadField`
  2. `styles[].imageUrl` 和 `images[].url` 也换成 `ImageUploadField`
- **预估**: 20 min

---

# 🟢 Phase 3：体验优化 + 标准后台功能

## O1 — Bookings / Orders 分页

- **优先级**: 中
- **现状**: 前端调用 `getAdminBookings()` / `getAdminOrders()` 不传分页参数
- **后端支持**: Bookings API 已支持 `?page=&limit=`，Orders API 目前返回全量数组
- **实现**:
  1. Orders 后端需要先改成返回 `{ data, total, page, limit }`（和 Bookings 一致）
  2. 前端两个页面都加上分页组件（页码按钮或"加载更多"）
- **预估**: 1 h

---

## O2 — Bookings / Orders 状态筛选

- **优先级**: 中
- **现状**: API 支持 `?status=`，但页面没有筛选 UI
- **实现**: 在页面顶部加一个 `<select>` 筛选状态（新预约 / 已联系 / 已确认 / 已取消 / 全部）
- **预估**: 20 min

---

## O3 — Bookings 状态变更备注优化

- **优先级**: 中
- **现状**: 使用 `window.prompt()` 输入备注，体验极差
- **修复**: 换成 Modal 组件（可用 `dialog` 或现有的 UI 组件）
- **预估**: 30 min

---

## O4 — Orders 状态变更加备注

- **优先级**: 低
- **现状**: Bookings 改状态时可以写备注，Orders 完全没这功能
- **实现**: 参考 Bookings 的备注逻辑，给 Orders 也加上
- **预估**: 25 min

---

## O5 — 全局搜索功能

- **优先级**: 低
- **适用页面**: Projects / Parties / Gallery / Bookings / Orders / Users
- **实现建议**:
  1. 前端列表页加一个 `<Input>` 搜索框
  2. 前端内存过滤（简单）或后端 API 加 `?q=` 参数（更彻底）
  3. 先从内存过滤做起，够用
- **预估**: 1 ~ 2 h（逐个页面加）

---

## O6 — 列表页表格排序

- **优先级**: 低
- **现状**: 表格不能点击列头排序
- **适用页面**: Projects / Parties / Gallery / Users / TimeSlots
- **实现**: 点击列头 → 切换 `sortOrder` 状态 → 内存排序
- **预估**: 1 h

---

## O7 — Admin 修改自己的密码

- **优先级**: 低
- **现状**: 登录后不能改密码
- **实现**:
  1. 在 AdminShell 的用户信息区加一个"修改密码"入口
  2. 后端新增 `PATCH /api/v1/admin/me/password`
  3. 表单: 旧密码 + 新密码 + 确认新密码
- **预估**: 40 min

---

## O8 — 操作日志（Audit Log）

- **优先级**: 低
- **现状**: 不知道谁在什么时候改了什么
- **适合记录的操作**:
  - 用户创建 / 删除 / 修改
  - Booking / Order 状态变更
  - Project / Party / Gallery / Category 的增删改
  - Settings 修改
- **实现方案**:
  1. 新建 `audit_logs` 表
  2. 在服务层关键操作后插入日志
  3. Admin 后台新增"操作日志"页面查看
- **预估**: 3 ~ 4 h（包含表设计 + 后端 + 前端）

---

## O9 — 数据导出（Excel / CSV）

- **优先级**: 低
- **适用**: Bookings / Orders / Users
- **实现**: 前端把当前列表数据导出为 CSV（纯前端即可，用 `Blob` + `URL.createObjectURL`）
- **预估**: 30 min

---

# 📋 快速检查清单（逐个勾选）

复制以下清单，做完一项勾一项：

## Phase 1 — Bug 修复
- [ ] B1 Cookie maxAge 改为 24 小时
- [ ] B2 创建用户返回 `initialPassword`
- [ ] B3 ProjectForm 补 `useRouter` 导入
- [ ] B4 NaN 参数校验（bookings/projects/time-slots）
- [ ] B5 Cart Orders 状态流转校验
- [ ] B6 Admin API Rate Limiting

## Phase 2 — 核心功能
- [ ] F1 Categories 新建
- [ ] F2 Categories 删除（含关联检查）
- [ ] F3 Users 编辑
- [ ] F4 Users 重置密码
- [ ] F5 Bookings 详情页
- [ ] F6 Orders 详情页
- [ ] F7 TimeSlots 完整编辑（时间/容量/备注）
- [ ] F8 PartyForm 多图上传（`imageUrls`）
- [ ] F9 Projects 图片上传接入

## Phase 3 — 体验优化
- [ ] O1 Bookings / Orders 分页
- [ ] O2 Bookings / Orders 状态筛选
- [ ] O3 Bookings 备注改用 Modal
- [ ] O4 Orders 状态变更加备注
- [ ] O5 全局搜索
- [ ] O6 表格排序
- [ ] O7 修改自己的密码
- [ ] O8 操作日志（Audit Log）
- [ ] O9 数据导出 CSV

---

# 💡 推荐开发顺序

如果你只有 1 天时间，按这个顺序做：

**上午（3 小时）**:
1. B1 → B2 → B3 → B4（P0 Bug 全清，约 1 h）
2. F1 → F2（分类增删，约 1 h）
3. F3 → F4（用户编辑 + 重置密码，约 1 h）

**下午（3 小时）**:
4. B5 → B6（P1 Bug + Rate Limit，约 2 h）
5. F5 → F6（Bookings + Orders 详情页，约 1.5 h，可能做不完一个）

**第二天**:
6. F7（TimeSlots 编辑）
7. F8（PartyForm 多图）
8. F9（Projects 图片上传）
9. O1 ~ O4（分页 + 筛选 + 备注优化）

**第三天及以后**（按需）:
10. O5 ~ O9（搜索、排序、改密码、日志、导出）
