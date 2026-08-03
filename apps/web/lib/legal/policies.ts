export const LEGAL_POLICY_SLUGS = [
  "privacy",
  "booking-terms",
  "cancellation-rescheduling",
  "party-terms",
] as const;

export type LegalPolicySlug = (typeof LEGAL_POLICY_SLUGS)[number];

type PolicySection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalPolicy = {
  title: string;
  description: string;
  updated: string;
  important?: string;
  sections: PolicySection[];
};

const COMMON = {
  en: {
    updated: "Last updated: 3 August 2026",
    consumerRights:
      "Nothing in these terms excludes, restricts or modifies any right or consumer guarantee that cannot lawfully be excluded under the Australian Consumer Law.",
  },
  zh: {
    updated: "最后更新：2026 年 8 月 3 日",
    consumerRights:
      "本条款不排除、限制或修改澳大利亚消费者法下任何依法不得排除的权利或消费者保障。",
  },
} as const;

const POLICIES: Record<"en" | "zh", Record<LegalPolicySlug, LegalPolicy>> = {
  en: {
    privacy: {
      title: "Privacy Policy",
      description:
        "How YezYY collects, uses, stores and handles personal information for DIY and party requests.",
      updated: COMMON.en.updated,
      sections: [
        {
          heading: "Who we are",
          paragraphs: [
            "YezYY is a DIY studio at G082/235 Springvale Rd, Glen Waverley VIC 3150. Questions or privacy requests can be sent to congdongdong03@gmail.com or made by calling 0430 787 712.",
          ],
        },
        {
          heading: "Information we collect",
          bullets: [
            "Contact details such as your name, phone number and email address.",
            "Booking details such as chosen projects, attendance, dates, times and messages.",
            "For parties, the birthday child’s name and age, project interests, accompanying-parent count and items you plan to bring.",
            "Booking history, policy acceptance, customer change requests, payment records and staff notes needed to operate the service.",
            "Optional written photo or video permission, including the consenting parent or guardian’s details when a child is involved.",
            "Basic technical and usage information when analytics, security or error-monitoring services are enabled.",
          ],
        },
        {
          heading: "Why we use it",
          bullets: [
            "To review, confirm, change and complete DIY or party requests.",
            "To contact you about availability, payment, reminders, cancellations and safety matters.",
            "To keep operational, accounting, security and consent records.",
            "To improve the website and understand which services customers find useful.",
            "To comply with legal obligations and respond to lawful requests.",
          ],
        },
        {
          heading: "Sharing and service providers",
          paragraphs: [
            "We do not sell personal information. We may disclose only what is reasonably needed to providers that host the website or database, deliver email, monitor errors or availability, measure website use, or provide professional services. Some providers may process data outside Australia. Their locations and safeguards depend on the providers enabled at the time.",
          ],
        },
        {
          heading: "Children and photos",
          paragraphs: [
            "A parent or legal guardian should provide booking information for a child. Photo or video permission is optional, separate from booking acceptance and can be declined without affecting a booking. Permission for a child must be given by a parent or legal guardian. We will record the stated scope and may stop future use after permission is withdrawn, although material already lawfully published or printed may not always be fully recoverable.",
          ],
        },
        {
          heading: "Storage, access and correction",
          paragraphs: [
            "We take reasonable steps to protect information and retain it only for as long as reasonably needed for operations, disputes, accounting, consent records or legal requirements. Contact us to request access or correction, withdraw optional photo permission, or make a privacy complaint. We may need to verify your identity before acting on a request.",
          ],
        },
        {
          heading: "Website analytics and cookies",
          paragraphs: [
            "If analytics is enabled, the website may use cookies or similar technologies to measure visits and booking steps. Security and error-monitoring tools may also record technical diagnostics. You can restrict cookies in your browser, although some features may work differently.",
          ],
        },
      ],
    },
    "booking-terms": {
      title: "Booking Terms",
      description:
        "Terms for ordinary DIY booking and waitlist requests at YezYY.",
      updated: COMMON.en.updated,
      important:
        "Submitting the form creates a request only. Please wait for manual confirmation from YezYY before travelling to the studio.",
      sections: [
        {
          heading: "Requests and confirmation",
          bullets: [
            "Ordinary DIY requests must be submitted at least 2 hours before the requested start and no more than 7 calendar days ahead, using Melbourne local time.",
            "A request, including a waitlist request, is not confirmed until YezYY staff confirms it by email or phone.",
            "Availability can change while a request is being reviewed. Staff may offer another time or contact you for more information.",
          ],
        },
        {
          heading: "Attendance and supervision",
          bullets: [
            "One person may book. Each available time can accommodate up to 8 people physically present, including DIY participants and accompanying adults.",
            "The minimum participant age is 5. Children aged 5–8 must be accompanied by an adult.",
            "Each DIY participant selects one project. A clear ‘Decide in store’ option is available when the project will be chosen on arrival.",
          ],
        },
        {
          heading: "Prices and payment",
          paragraphs: [
            "Prices are shown in Australian dollars and are paid in store. No online payment is taken for an ordinary DIY request. Materials, colours and bases can vary with store availability; staff will explain any price difference before work begins.",
          ],
        },
        {
          heading: "Arrival, conduct and safety",
          paragraphs: [
            "Please follow staff safety instructions and use tools and materials as directed. A parent or guardian remains responsible for supervising the children in their care. YezYY may stop unsafe, abusive or seriously disruptive conduct. Reasonable costs may be requested for deliberate damage, subject to applicable law.",
          ],
        },
        {
          heading: "Changes, cancellations and late arrival",
          paragraphs: [
            "The Cancellation & Rescheduling Policy forms part of these terms. If you arrive more than 20 minutes late, the original time is no longer guaranteed and staff may need to rearrange the visit.",
          ],
        },
        {
          heading: "Australian Consumer Law",
          paragraphs: [COMMON.en.consumerRights],
        },
      ],
    },
    "cancellation-rescheduling": {
      title: "Cancellation & Rescheduling Policy",
      description:
        "Notice periods and outcomes for ordinary DIY and party changes at YezYY.",
      updated: COMMON.en.updated,
      sections: [
        {
          heading: "Ordinary DIY bookings",
          bullets: [
            "Cancellation or rescheduling requested at least 2 hours before the confirmed start is free.",
            "A request made less than 2 hours before the start is handled at staff discretion. YezYY does not charge an ordinary DIY cancellation fee.",
            "Rescheduling is subject to capacity and opening hours. A replacement time is not secured until staff confirms it.",
            "If you are more than 20 minutes late, the original time is no longer guaranteed and staff may rearrange the visit.",
          ],
        },
        {
          heading: "Party bookings",
          bullets: [
            "Cancellation requested at least 48 hours before the final confirmed guest start is eligible for a full refund of the venue fee/deposit.",
            "The venue fee/deposit is ordinarily non-refundable when cancellation is requested less than 48 hours before the final guest start.",
            "A party reschedule depends on staff approval, capacity and the practical costs already incurred. Staff will record the agreed outcome.",
          ],
        },
        {
          heading: "How to request a change",
          paragraphs: [
            "Use the secure management link in your booking email, reply to the booking email, call 0430 787 712, or email congdongdong03@gmail.com. A request is not complete until YezYY records or confirms the change.",
          ],
        },
        {
          heading: "Consumer rights and exceptional circumstances",
          paragraphs: [
            `${COMMON.en.consumerRights} If YezYY cannot provide a confirmed service, staff will contact you about a suitable remedy. Evidence may be requested when an exceptional circumstance is relevant to a discretionary outcome.`,
          ],
        },
      ],
    },
    "party-terms": {
      title: "Party Terms",
      description:
        "Attendance, payment, food, supervision and cancellation terms for YezYY parties.",
      updated: COMMON.en.updated,
      important:
        "A party request is not confirmed until staff confirms the date and time. The A$95 or A$145 venue fee is also the deposit and must be paid in store during a separate visit before the party date.",
      sections: [
        {
          heading: "Packages and attendance",
          bullets: [
            "The A$95 package includes 1.5 hours of guest use. The A$145 package includes 2.5 hours of guest use.",
            "A party requires 4–8 DIY participants and 1–2 accompanying parents. The birthday child must be at least 5 years old.",
            "Each participant chooses at least one DIY project and has a minimum DIY project spend of A$45.",
            "Staff provides a 30-minute setup period before guest use and a 30-minute cleanup period afterwards.",
          ],
        },
        {
          heading: "Confirmation and venue-fee deposit",
          paragraphs: [
            "The requested time is a preference only. Staff may confirm it or propose another time. After confirmation, staff will arrange a payment deadline. The venue fee/deposit is paid in store before the party date; no online payment is taken. The party is not secured until the required venue fee/deposit has been paid and recorded.",
          ],
        },
        {
          heading: "Food, cake and additional charges",
          bullets: [
            "You may bring cake, drinks, food and snacks. You are responsible for allergy information, safe handling and suitable supervision of items you bring.",
            "Staff cake cutting is A$15 when requested.",
            "A cleaning charge of A$15–A$35 may apply when additional cleaning is reasonably required.",
            "Party overtime of 15–30 minutes may incur A$15–A$35 when applicable. Staff records the final amount.",
          ],
        },
        {
          heading: "Included benefits",
          bullets: [
            "Birthday setup and decorations.",
            "A surprise gift for the birthday child, selected by staff from a plush toy, Lego set or toy.",
            "A 15% in-store voucher, excluding Pop Mart, venue fees and booking-related charges.",
          ],
        },
        {
          heading: "Supervision, safety and photos",
          paragraphs: [
            "Parents remain responsible for the children in their care and must follow staff safety directions. Photo or video permission is optional and separate from accepting these party terms. Permission for a child must be given by a parent or legal guardian.",
          ],
        },
        {
          heading: "Cancellation and consumer rights",
          paragraphs: [
            `The Cancellation & Rescheduling Policy forms part of these terms. ${COMMON.en.consumerRights}`,
          ],
        },
      ],
    },
  },
  zh: {
    privacy: {
      title: "隐私政策",
      description:
        "说明 YezYY 如何收集、使用、保存和处理手作及派对申请中的个人信息。",
      updated: COMMON.zh.updated,
      sections: [
        {
          heading: "我们是谁",
          paragraphs: [
            "YezYY 是位于 G082/235 Springvale Rd, Glen Waverley VIC 3150 的手作工作室。如有隐私问题或申请，请发送邮件至 congdongdong03@gmail.com，或致电 0430 787 712。",
          ],
        },
        {
          heading: "我们收集的信息",
          bullets: [
            "姓名、电话号码和邮箱等联系信息。",
            "所选项目、到店人数、日期、时段及留言等预约信息。",
            "派对申请中的生日小朋友姓名和年龄、项目偏好、陪同家长人数及计划自带物品。",
            "为提供服务所需的预约历史、政策接受记录、顾客变更申请、付款记录及员工备注。",
            "可选的照片或视频书面授权；涉及儿童时，也会记录同意授权的家长或法定监护人信息。",
            "启用网站分析、安全或错误监控服务时产生的基本技术和使用信息。",
          ],
        },
        {
          heading: "使用目的",
          bullets: [
            "审核、确认、修改并完成手作或派对申请。",
            "就可用时段、付款、提醒、取消及安全事项与您联系。",
            "保存运营、会计、安全及授权记录。",
            "改进网站并了解顾客关注的服务。",
            "履行法律义务及回应合法要求。",
          ],
        },
        {
          heading: "共享与服务供应商",
          paragraphs: [
            "我们不会出售个人信息。我们仅会在合理必要范围内向网站或数据库托管、邮件发送、错误或在线状态监控、网站使用分析及专业服务供应商提供信息。部分供应商可能在澳大利亚境外处理数据，具体地点和保障措施取决于当时启用的供应商。",
          ],
        },
        {
          heading: "儿童与照片",
          paragraphs: [
            "儿童的预约信息应由家长或法定监护人提供。照片或视频授权属于可选项目，与预约同意分开；拒绝授权不会影响预约。儿童照片必须由家长或法定监护人授权。撤回授权后，我们会停止未来使用，但已合法发布或印刷的材料未必能全部收回。",
          ],
        },
        {
          heading: "保存、安全、查阅与更正",
          paragraphs: [
            "我们会采取合理措施保护信息，并仅在运营、争议、会计、授权记录或法律要求所需期间内保存。您可以联系我们申请查阅或更正信息、撤回可选照片授权或提出隐私投诉。处理申请前，我们可能需要核实您的身份。",
          ],
        },
        {
          heading: "网站分析与 Cookie",
          paragraphs: [
            "启用分析服务时，网站可能使用 Cookie 或类似技术统计访问和预约步骤；安全及错误监控工具也可能记录技术诊断信息。您可以在浏览器中限制 Cookie，但部分功能的表现可能有所不同。",
          ],
        },
      ],
    },
    "booking-terms": {
      title: "预约条款",
      description: "适用于 YezYY 普通手作预约及候补申请的条款。",
      updated: COMMON.zh.updated,
      important:
        "提交表单只代表提出申请。前往门店前，请等待 YezYY 员工人工确认。",
      sections: [
        {
          heading: "申请与确认",
          bullets: [
            "普通手作须按墨尔本当地时间至少提前 2 小时申请，且最多提前 7 个日历日。",
            "普通预约及候补申请只有在 YezYY 员工通过邮件或电话确认后才成立。",
            "审核期间可用情况可能变化；员工可能提出其他时段或联系您补充信息。",
          ],
        },
        {
          heading: "人数与陪同",
          bullets: [
            "支持单人预约。每个时段店内实际最多容纳 8 人，包括手作参与者和陪同成人。",
            "参与者最低年龄为 5 岁；5 至 8 岁儿童须由成人陪同。",
            "每位手作参与者选择一个项目。如希望到店后再选，可选择清晰标注的“到店决定”。",
          ],
        },
        {
          heading: "价格与付款",
          paragraphs: [
            "所有价格均为澳元，并在店内付款。普通手作申请不会收取线上款项。材料、颜色和底坯会随门店库存变化；如价格发生变化，员工会在开始制作前说明。",
          ],
        },
        {
          heading: "到店、安全与行为",
          paragraphs: [
            "请遵守员工安全指引，并按说明使用工具和材料。家长或监护人仍须负责照看自己陪同的儿童。YezYY 可制止危险、辱骂或严重干扰他人的行为。对于故意损坏，YezYY 可在法律允许范围内要求承担合理费用。",
          ],
        },
        {
          heading: "变更、取消与迟到",
          paragraphs: [
            "《取消与改期政策》构成本条款的一部分。迟到超过 20 分钟，原时段将不再保证，员工可能需要重新安排到店时间。",
          ],
        },
        {
          heading: "澳大利亚消费者法",
          paragraphs: [COMMON.zh.consumerRights],
        },
      ],
    },
    "cancellation-rescheduling": {
      title: "取消与改期政策",
      description: "说明 YezYY 普通手作和派对变更所需的通知时间及处理方式。",
      updated: COMMON.zh.updated,
      sections: [
        {
          heading: "普通手作预约",
          bullets: [
            "至少在确认开始时间前 2 小时提出取消或改期，可免费办理。",
            "不足 2 小时提出的申请由员工酌情处理；YezYY 不收取普通手作取消费。",
            "改期取决于容量和营业时间，只有员工确认后新时段才成立。",
            "迟到超过 20 分钟，原时段将不再保证，员工可能重新安排到店时间。",
          ],
        },
        {
          heading: "派对预约",
          bullets: [
            "至少在最终确认的宾客开始时间前 48 小时提出取消，可全额退还场地费／订金。",
            "不足 48 小时取消时，场地费／订金通常不予退还。",
            "派对改期须经员工同意，并取决于容量及已经发生的实际准备成本；员工会记录最终约定。",
          ],
        },
        {
          heading: "如何提出变更",
          paragraphs: [
            "可使用预约邮件中的安全管理链接、回复预约邮件、致电 0430 787 712，或发送邮件至 congdongdong03@gmail.com。只有 YezYY 记录或确认后，变更才完成。",
          ],
        },
        {
          heading: "消费者权利与特殊情况",
          paragraphs: [
            `${COMMON.zh.consumerRights} 如果 YezYY 无法提供已确认的服务，员工会联系您安排适当补救。对于需要酌情处理的特殊情况，我们可能要求提供相关证明。`,
          ],
        },
      ],
    },
    "party-terms": {
      title: "派对条款",
      description: "适用于 YezYY 派对的人数、付款、食物、陪同及取消条款。",
      updated: COMMON.zh.updated,
      important:
        "派对申请只有在员工确认日期和时段后才成立。95 澳元或 145 澳元场地费同时作为订金，须在派对日期前另行到店支付。",
      sections: [
        {
          heading: "套餐与人数",
          bullets: [
            "95 澳元套餐包含 1.5 小时宾客活动时间；145 澳元套餐包含 2.5 小时宾客活动时间。",
            "派对须有 4 至 8 位手作参与者，并由 1 至 2 位家长陪同；生日小朋友须年满 5 岁。",
            "每位参与者须至少选择一个手作项目，且每位手作项目最低消费为 45 澳元。",
            "员工会安排活动前 30 分钟布置及活动后 30 分钟整理。",
          ],
        },
        {
          heading: "确认与场地费订金",
          paragraphs: [
            "申请时段仅为首选；员工可能确认该时段或提出其他时段。确认后，员工会安排付款期限。场地费／订金须在派对日期前到店支付，网站不收取线上款项。只有场地费／订金已支付并被记录后，派对才正式保留。",
          ],
        },
        {
          heading: "食物、蛋糕及额外费用",
          bullets: [
            "可自带蛋糕、饮料、食物和零食；您需负责自带物品的过敏信息、安全处理及适当看管。",
            "如需员工切蛋糕，费用为 15 澳元。",
            "如确实需要额外清洁，可能收取 15–35 澳元清洁费。",
            "派对超时 15–30 分钟时，可能收取 15–35 澳元；最终金额由员工记录。",
          ],
        },
        {
          heading: "包含内容",
          bullets: [
            "生日布置与装饰。",
            "由员工从毛绒玩具、乐高套装或玩具中为生日小朋友选择一份惊喜礼物。",
            "一张店内 85 折优惠券，不适用于 Pop Mart、场地费及预约相关费用。",
          ],
        },
        {
          heading: "陪同、安全与照片",
          paragraphs: [
            "家长仍须负责照看自己陪同的儿童，并遵守员工安全指引。照片或视频授权属于可选项目，与接受派对条款分开；儿童照片须由家长或法定监护人授权。",
          ],
        },
        {
          heading: "取消与消费者权利",
          paragraphs: [
            `《取消与改期政策》构成本条款的一部分。${COMMON.zh.consumerRights}`,
          ],
        },
      ],
    },
  },
};

export function getLegalPolicy(
  locale: "en" | "zh",
  slug: LegalPolicySlug,
): LegalPolicy {
  return POLICIES[locale][slug];
}
