# YEZZ 独立站技术设计方案

## 1. 项目概述

YEZZ 独立站是一个面向约会、生日派对、朋友聚会和手作体验客户的 **DIY 体验馆预约型官网**。

网站第一阶段的核心目标不是做完整电商，而是通过品牌氛围、项目展示、派对套餐和作品展示，引导客户 **加微信咨询** 或 **提交预约表单**。

- **语言**：中英双语（`/zh/`、`/en/`）
- **技术栈**：Next.js 15 + TypeScript + Tailwind CSS + Sanity CMS
- **部署**：Vercel
- **预计工期**：2-3 周

---

## 2. 技术架构

| 层级 | 技术 | 用途 |
|------|------|------|
| **框架** | Next.js 15 (App Router) | SSR + ISR，现代路由 |
| **语言** | TypeScript | 类型安全 |
| **样式** | Tailwind CSS 3.x + shadcn/ui | 原子化样式 + 组件库 |
| **国际化** | next-intl | 中英双语，URL 前缀 |
| **CMS** | Sanity | 内容管理，图片 CDN |
| **图片** | Next.js Image + Sanity CDN | 自动 WebP、懒加载、响应式 |
| **表单** | React Hook Form + Zod | 表单验证 |
| **邮件** | Resend | 预约通知邮件 |
| **字体** | Google Fonts（中文：Noto Serif SC，英文：Inter / Playfair Display）| 中文用衬线体现手作温度，英文用无衬线保证清晰 |
| **部署** | Vercel | 自动 CI/CD，边缘网络 |
| **动画** | Framer Motion | 页面过渡、滚动动画、微交互 |

**渲染策略**：
- 首页、项目页、派对页、Gallery：SSR（内容来自 CMS，SEO 预留扩展性）
- 预约页、联系页：Static（内容较固定）

---

## 3. 配色方案

| 用途 | 颜色 | 色值 |
|------|------|------|
| **背景主色** | 暖奶油白 | `#FDF6F0` |
| **品牌主色** | 柔雾粉 | `#E8A0BF` |
| **辅助色** | 鼠尾草绿 | `#9CAF88` |
| **文字主色** | 暖炭灰 | `#3D3D3D` |
| **文字次要** | 暖灰 | `#8A8A8A` |
| **强调/按钮** | 焦糖棕 | `#C1785C` |
| **点缀** | 淡薰衣草 | `#D8C3E3` |

**整体感觉**：奶油白打底 + 柔粉绿搭配 + 焦糖棕做重点。统一在温柔的色调里，让作品图片成为视觉焦点。

---

## 4. 信息架构

```
/locale
├── /                    首页
├── /projects            DIY 项目页
│   └── /[slug]          项目详情（预留，第一版用 Modal 代替）
├── /parties             派对套餐页
├── /gallery             作品展示页
├── /book                预约页
└── /contact             联系我们
```

**URL 示例**：
- 中文首页：`/zh`
- 英文首页：`/en`
- 中文项目页：`/zh/projects`
- 英文派对页：`/en/parties`

**导航栏**：Logo（左） + 页面链接（中）+ 语言切换 / Book Now 按钮（右）

移动端：汉堡菜单，展开后全屏导航。

---

## 5. Sanity CMS 内容模型

```typescript
// 1. DIY 项目
diyProject: {
  name: string           // 项目名（中英）
  slug: slug             // URL 标识
  category: reference    // 关联分类
  description: text      // 描述（中英）
  images: array[image]   // 项目图片
  priceRange: string     // 价格区间，如 "From $35"
  duration: string       // 时长，如 "1-2 hours"
  tags: array[string]    // 标签：date, birthday, kids, etc.
  order: number          // 排序
}

// 2. 项目分类
projectCategory: {
  name: string           // 分类名（中英）
  slug: slug
  description: text
  icon: string           // Lucide icon name
  order: number
}

// 3. 派对套餐
partyPackage: {
  name: string
  slug: slug
  description: text
  includes: array[string] // 包含内容
  images: array[image]
  minPeople: number
  maxPeople: number
  priceIndicator: string  // "From $45/person"
  tags: array[string]
}

// 4. Gallery 图片
galleryImage: {
  image: image
  category: string        // couple | birthday | kids | gift | store | works
  caption: text           // 可选描述
  order: number
}

// 5. 预约记录（表单提交后创建）
booking: {
  name: string
  phone: string
  wechat: string
  email: string
  preferredDate: date
  numberOfPeople: number
  activityType: string    // date | birthday | friends | kids | mobile
  interestedProject: string
  message: text
  status: string          // new | contacted | confirmed | cancelled
  submittedAt: datetime
}

// 6. 网站全局设置
siteSettings: {
  storeName: string
  address: string
  businessHours: string
  phone: string
  email: string
  wechatQrCode: image
  instagram: string
  xiaohongshu: string
  googleMapUrl: string
  seoTitle: string
  seoDescription: string
}
```

Sanity 后台面板可直接查看所有 `booking` 记录，支持筛选和搜索。

---

## 6. 页面设计

### 6.1 首页（Home）

**目标**：3 秒内让用户知道"这是什么地方、能做什么、怎么预约"。

| 区块 | 内容 | 设计要点 |
|------|------|----------|
| **Hero** | 大标题 "Create Your Own Masterpiece" / "亲手制作，独一无二" + 副标题 + CTA 按钮 + 背景图 | 全屏高度，图片叠加半透明暖奶油色遮罩，CTA 按钮用焦糖棕 `#C1785C` |
| **Why DIY** | 3 个价值点卡片：Relieve Stress / Bonding Time / Unique Gifts | 横向 3 列，卡片圆角大（`rounded-2xl`），hover 轻微上浮 + 阴影 |
| **DIY 项目速览** | 展示 3-4 个热门项目，带图片和简短描述 | 横向滑动卡片（移动端）或网格（桌面端），"View All" 链接到项目页 |
| **派对套餐** | 2 个主推套餐简介 + "Explore Packages" | 左右分栏图文交替 |
| **Gallery 精选** | 4-6 张精选作品图 | 图片 hover 轻微放大，点击可放大查看（Lightbox）|
| **FAQ** | 3-4 个高频问题 | 手风琴折叠（Accordion）|
| **CTA 收尾** | "Ready to Create?" + Book Now 按钮 + 微信二维码 | 大留白，聚焦转化 |
| **Footer** | 地址、营业时间、电话、邮箱、社交链接、导航链接 | 奶油色背景，信息分栏排列 |

### 6.2 DIY 项目页（Projects）

- 顶部：页面标题 + 一句话描述
- 筛选栏：按分类筛选（All / Phone Cases / Beading / Plaster / Perler Beads / Diamond Painting / Wood / LEGO），可横向滚动
- 项目网格：2 列（桌面）/ 1 列（移动），每个项目卡片包含：图片、名称、分类标签、价格区间 + 时长、适合标签（彩色小徽章）
- 点击卡片展开 Modal（第一版不跳独立详情页），显示大图、详细描述、直接跳转到预约页并预填项目类型

### 6.3 派对套餐页（Parties）

- 页面标题 + 描述
- 套餐卡片垂直排列，每个占一整行，左图右文/右图左文交替
- 每张卡片：名称、描述、包含项目列表（打勾图标）、适用人数、价格指示、CTA 按钮 "Book This Package"
- 底部："Have questions? Contact us!" + 联系方式

### 6.4 作品展示页（Gallery）

- 页面标题 + "Explore creations from our community"
- 筛选标签：All / Couple Works / Birthday Parties / Kids' Creations / Gifts / Our Store / Featured Works
- 图片网格：Masonry 瀑布流或均匀网格，3/2/1 列响应式
- 图片 hover 显示分类标签 + caption，点击放大查看（Lightbox）
- 加载策略：懒加载 + 渐进式加载（模糊占位图 → 高清图）

### 6.5 预约页（Book）

- 页面标题 "Book Your Experience"
- 左右分栏（桌面）/ 上下堆叠（移动）：左侧表单，右侧店铺信息卡片

**表单字段**：

| 字段 | 类型 | 必填 |
|------|------|------|
| Name | text | ✅ |
| Phone Number | tel | ✅ |
| WeChat ID | text | |
| Email | email | |
| Preferred Date | date | ✅ |
| Number of People | number/select | ✅ |
| Activity Type | select | ✅ |
| Interested Project | select | |
| Message / Special Requests | textarea | |

**提交后**：
- 成功："Thank you! We'll contact you soon to confirm your booking." + 微信二维码提示
- 触发：Resend 邮件通知店主 + 数据写入 Sanity `booking`

### 6.6 联系我们（Contact）

- 页面标题 "Get in Touch"
- 信息卡片网格：地址（Google Maps 嵌入）、营业时间、电话、邮箱、Instagram、小红书、微信二维码
- 底部可加快速留言表单（Name + Message），同样发到邮件/CMS

---

## 7. 全局交互与动画

| 交互 | 实现 | 感觉 |
|------|------|------|
| **页面切换** | Framer Motion `AnimatePresence` | 淡入淡出，温和不突兀 |
| **滚动动画** | Framer Motion `whileInView` | 元素进入视口时淡入 + 轻微上移 |
| **导航栏滚动** | 向下滚动隐藏，向上滚动显示 | 节省空间，专注内容 |
| **按钮 Hover** | 背景色加深 + 轻微上移 `translateY(-2px)` | 有反馈感 |
| **图片 Hover** | 轻微放大 `scale(1.03)` + 阴影加深 | 吸引点击，有层次感 |
| **移动端菜单** | 全屏遮罩，从右侧滑入，链接逐个淡入 | 优雅不廉价 |
| **加载状态** | 骨架屏（Skeleton）用于 CMS 内容区域 | 避免白屏等待 |

**原则**：动画服务于体验，不炫技。手作店网站应该让人感觉"温暖、放松"。

---

## 8. 预约表单数据流

```
用户填写表单 → 点击 Submit
    ↓
React Hook Form + Zod 前端验证
    ↓
Next.js Server Action
    ├── 写入 Sanity（创建 booking 文档）
    │   └── Sanity 后台即时可见
    └── 调用 Resend API 发送邮件
        ├── To: 店主邮箱
        │   Subject: "New Booking from [Name]"
        │   内容：所有表单字段 + 提交时间
        └── To: 用户邮箱（如果填了）
            Subject: "We've received your booking!"
            内容：感谢 + 店铺信息 + 微信二维码
    ↓
前端显示成功/错误状态
```

**错误处理**：
- Sanity 写入失败：回滚邮件发送，前端显示 "Something went wrong, please try again or contact us directly."
- Resend 发送失败：记录日志，但不阻塞用户（数据已存 CMS，店主可在后台查看）

**防重复提交**：按钮 loading 状态，禁用再次点击。

---

## 9. MVP 范围

### 第一版做（Must Have）
- [ ] 6 个页面完整实现
- [ ] Sanity CMS 搭建 + 内容模型
- [ ] 中英双语（next-intl）
- [ ] 响应式（Mobile / Tablet / Desktop）
- [ ] 预约表单 → Sanity + Resend 邮件
- [ ] Google Maps 嵌入
- [ ] 基础 SEO（title、description、语义化 HTML）
- [ ] 图片懒加载 + Next.js Image 优化

### 第一版不做（Won't Have，预留扩展）
- [ ] 在线支付（Stripe / 微信 / 支付宝）
- [ ] 用户登录 / 会员系统
- [ ] 在线预约日历（选时间段）
- [ ] 项目独立详情页（用 Modal 代替）
- [ ] 博客 / 教程内容
- [ ] 多店铺
- [ ] 高级动画（视差滚动、WebGL）
- [ ] 后台管理界面（直接用 Sanity 面板）
- [ ] 数据分析 / 埋点（Google Analytics 以后加）

---

## 10. 开发顺序

| 阶段 | 内容 | 预估时间 |
|------|------|----------|
| **Phase 1: 基础设施** | 项目初始化、Tailwind 配置、next-intl 搭建、Sanity 项目创建、CI/CD（Vercel） | 1 天 |
| **Phase 2: 全局组件** | Layout（导航、Footer）、颜色系统、字体、按钮等基础组件 | 1 天 |
| **Phase 3: 静态页面** | 首页（除 CMS 内容外）、联系我们、预约页（表单 UI） | 2 天 |
| **Phase 4: CMS 集成** | Sanity Schema、数据录入、页面接入 CMS 数据 | 2 天 |
| **Phase 5: 表单 + 邮件** | Server Action、Resend 集成、表单验证、成功/错误状态 | 1-2 天 |
| **Phase 6: 打磨** | 动画、响应式细节、性能优化、内容填充、测试 | 2 天 |

**总计**：约 9-11 个工作日（建议预留 2-3 周）。

---

## 11. 素材清单

| 素材 | 用途 | 优先级 |
|------|------|--------|
| 店铺环境照片 | Hero、Contact、Gallery | 高 |
| 各项目作品图（每类 2-3 张）| Projects、Gallery | 高 |
| 派对活动照片 | Parties、Gallery | 中 |
| 品牌 LOGO（如有）| 导航栏、Footer | 中 |
| 微信二维码 | Contact、预约成功页、Footer | 高 |
| Google Maps 地址链接 | Contact | 高 |
| Instagram / 小红书链接 | Footer | 低 |
| 文案内容（中英文）| 所有页面 | 高（可先用 CMS 占位，后续替换）|

---

## 12. 核心用户路径

### 路径 1：约会用户
首页看到 Date Ideas → 进入 Couple DIY Date → 查看项目和作品 → 点击 Book Now 或 Add WeChat

### 路径 2：生日派对用户
首页看到 Birthday Party → 进入 Party Packages → 查看套餐和 Gallery → 提交预约表单

### 路径 3：普通 DIY 用户
首页看到 DIY Projects → 选择项目分类 → 查看项目介绍 → 加微信确认时间和价格

### 路径 4：上门活动用户
首页或派对页看到 Mobile DIY Party → 了解上门活动 → 提交需求 → 人工报价
