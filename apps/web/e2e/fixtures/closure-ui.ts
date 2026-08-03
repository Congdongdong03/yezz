import { expect, type Page } from "@playwright/test"
import type { ClosureFixture, LiveBookingFixture } from "./closure-database"

type RequestKind = "bookings" | "cart-orders"
type AdminKind = "bookings" | "orders"

export type StatusTransitionBody = {
  status: "contacted" | "confirmed" | "cancelled"
  expectedStatus: "new" | "contacted" | "confirmed" | "cancelled"
  operationId: string
  note?: string
}

export function closureContact(label: string) {
  const suffix = label.slice(0, 8)
  return {
    name: `Closure Customer ${suffix}`,
    phone: `0400${suffix
      .replace(/[^0-9]/g, "")
      .padEnd(6, "7")
      .slice(0, 6)}`,
    email: `closure-${suffix}@example.test`,
  }
}

export async function selectClosureSlot(
  page: Page,
  fixture: ClosureFixture
): Promise<void> {
  const targetMonth = fixture.slotDate.slice(0, 7)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const dateButton = page.locator(`[data-date="${fixture.slotDate}"]`)
    if (await dateButton.count()) {
      await expect(dateButton).toBeEnabled()
      await dateButton.click()
      const slotButton = page.locator(`[data-slot-id="${fixture.slotId}"]`)
      await expect(slotButton).toBeVisible()
      await expect(slotButton).toBeEnabled()
      await slotButton.click()
      return
    }
    const shownMonth = await page
      .locator("p.font-medium.text-warm-charcoal")
      .filter({ hasText: /^\d{4}-\d{2}/ })
      .first()
      .textContent()
    if (shownMonth?.includes(targetMonth)) break
    await page.getByRole("button", { name: /Next month|下个月/ }).click()
  }
  throw new Error(`Closure fixture date ${fixture.slotDate} was not selectable`)
}

export async function captureCreatedRequest(
  page: Page,
  kind: RequestKind,
  submit: () => Promise<void>
): Promise<string> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === `/api/backend/v1/${kind}`
  )
  await submit()
  const response = await responsePromise
  expect(response.status()).toBe(201)
  const payload = (await response.json()) as {
    success: boolean
    data?: { id?: string }
  }
  expect(payload.success).toBe(true)
  expect(payload.data?.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  )
  return payload.data!.id!
}

export async function submitClosureOrdinaryForm(options: {
  page: Page
  fixture: ClosureFixture
  contact: ReturnType<typeof closureContact>
  participantCount: number
}) {
  const { page, fixture, contact, participantCount } = options
  if (!fixture.projectId || fixture.flow !== "experience") {
    throw new Error("An experience closure fixture is required")
  }
  await page.goto("/en/book")
  await page
    .getByLabel(new RegExp(fixture.offering.en))
    .fill(String(participantCount))
  await page.getByRole("button", { name: "Continue" }).click()
  await page
    .locator('input[name="participantCount"]')
    .fill(String(participantCount))
  await page.locator('input[name="youngChildCount"]').fill("0")
  await page.locator('input[name="accompanyingAdultCount"]').fill("0")
  await page.getByRole("button", { name: "Continue" }).click()
  const availabilityResponse = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      response.request().method() === "GET" &&
      url.pathname === "/api/v1/availability/ordinary" &&
      url.searchParams.get("date") === fixture.slotDate
    )
  })
  await page.getByLabel("Visit date", { exact: true }).fill(fixture.slotDate)
  expect((await availabilityResponse).status()).toBe(200)
  await page
    .getByRole("button", {
      name: new RegExp(`^Request this time: ${fixture.slotStartTime}\\b`),
    })
    .click()
  await page.getByRole("button", { name: "Continue" }).click()
  await page.locator('input[name="name"]').fill(contact.name)
  await page.locator('input[name="phone"]').fill(contact.phone)
  await page.locator('input[name="email"]').fill(contact.email)
  await page.locator('input[name="policyAccepted"]').check()
  return captureCreatedRequest(page, "bookings", async () => {
    await page.getByRole("button", { name: "Send booking request" }).click()
  })
}

export async function submitLiveOrdinaryForm(options: {
  page: Page
  fixture: LiveBookingFixture
  locale: "en" | "zh"
  email: string
  mode: "booking" | "waitlist"
}) {
  const { page, fixture, locale, email, mode } = options
  await page.goto(`/${locale}/book`)
  const shortProject = page.locator(
    `input[aria-label*="${fixture.projects.short.seed.name[locale]}"]`
  )
  const longProject = page.locator(
    `input[aria-label*="${fixture.projects.long.seed.name[locale]}"]`
  )
  await shortProject.fill("1")
  await longProject.fill("1")
  await expect(shortProject).toHaveValue("1")
  await expect(longProject).toHaveValue("1")
  const continueButton = page.getByRole("button", {
    name: locale === "zh" ? "继续" : "Continue",
  })
  await continueButton.click()
  await page.locator('input[name="participantCount"]').fill("2")
  await page.locator('input[name="youngChildCount"]').fill("0")
  await page.locator('input[name="accompanyingAdultCount"]').fill("1")
  await continueButton.click()
  const availabilityResponse = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      response.request().method() === "GET" &&
      url.pathname === "/api/v1/availability/ordinary" &&
      url.searchParams.get("date") === fixture.bookingDate
    )
  })
  await page
    .getByLabel(locale === "zh" ? "到店日期" : "Visit date", { exact: true })
    .fill(fixture.bookingDate)
  expect((await availabilityResponse).status()).toBe(200)
  const slotAction =
    mode === "waitlist"
      ? locale === "zh"
        ? "加入候补"
        : "Join waitlist"
      : locale === "zh"
        ? "申请此时段"
        : "Request this time"
  const slotButton = page.getByRole("button", {
    name: new RegExp(`^${slotAction}: 10:00\\b`),
  })
  await expect(slotButton).toBeVisible()
  await expect(slotButton).toBeEnabled()
  await slotButton.click()
  await continueButton.click()
  await page.locator('input[name="name"]').fill(`UI ${fixture.runId}`)
  await page.locator('input[name="phone"]').fill("0430787722")
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="policyAccepted"]').check()
  return captureCreatedRequest(page, "bookings", async () => {
    await page
      .getByRole("button", {
        name:
          locale === "zh"
            ? mode === "waitlist"
              ? "加入候补"
              : "提交预约申请"
            : mode === "waitlist"
              ? "Join the waitlist"
              : "Send booking request",
      })
      .click()
  })
}

export async function submitLivePartyForm(options: {
  page: Page
  fixture: LiveBookingFixture
  email: string
  packageLabel: "A$95" | "A$145"
}) {
  const { page, fixture, email, packageLabel } = options
  await page.goto("/zh/parties")
  const card = page.locator("article").filter({ hasText: packageLabel })
  await card.getByRole("button", { name: /^申请.*套餐$/ }).click()
  const form = card.getByRole("form")
  await form.locator('input[name="name"]').fill(`派对 UI ${fixture.runId}`)
  await form.locator('input[name="phone"]').fill("0430787733")
  await form.locator('input[name="email"]').fill(email)
  await form.locator('input[name="birthdayChildName"]').fill("小乐")
  await form.locator('input[name="birthdayChildAge"]').fill("7")
  await form.getByRole("button", { name: "继续" }).click()
  await form.locator('input[name="projectInterests"]').first().check()
  await form.locator('input[name="desiredDate"]').fill(fixture.bookingDate)
  await form.getByRole("button", { name: /申请 12:00/ }).click()
  await form.getByRole("button", { name: "继续" }).click()
  await expect(form.locator('input[name="cakeCuttingRequested"]')).toHaveCount(
    0
  )
  await form.locator('input[name="byoCake"]').check()
  await expect(form.locator('input[name="cakeCuttingRequested"]')).toBeVisible()
  await form.locator('input[name="policyAccepted"]').check()
  return captureCreatedRequest(page, "bookings", async () => {
    await form.getByRole("button", { name: "提交派对申请" }).click()
  })
}

export async function transitionFromAdmin(options: {
  page: Page
  kind: AdminKind
  requestId: string
  actionName: "标记为已联系" | "确认预约" | "取消预约" | "标记已完成"
  note?: string
}): Promise<StatusTransitionBody> {
  const { page, kind, requestId, actionName, note } = options
  const path =
    kind === "bookings"
      ? `/api/backend/v1/admin/bookings/${requestId}/transitions`
      : `/api/backend/v1/admin/orders/${requestId}/status`
  const method = kind === "bookings" ? "POST" : "PATCH"
  await page.goto(`/admin/${kind}/${requestId}`)
  await expect(
    page.getByRole("heading", {
      name: kind === "bookings" ? /预约详情/ : /产品预约详情/,
    })
  ).toBeVisible()

  await page.getByRole("button", { name: actionName, exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  if (note && (await dialog.getByLabel("处理说明").count()) > 0) {
    await dialog.getByLabel("处理说明").fill(note)
  }
  if (await dialog.getByLabel("已联系顾客并确认该时段").count()) {
    await dialog.getByLabel("已联系顾客并确认该时段").check()
  }

  const requestPromise = page.waitForRequest(
    (request) =>
      request.method() === method && new URL(request.url()).pathname === path
  )
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      new URL(response.url()).pathname === path
  )
  await dialog.getByRole("button", { name: actionName, exact: true }).click()
  const [request, response] = await Promise.all([
    requestPromise,
    responsePromise,
  ])
  expect(response.status()).toBe(200)
  const rawBody = request.postDataJSON() as StatusTransitionBody & {
    toStatus?: StatusTransitionBody["status"]
  }
  const body: StatusTransitionBody = {
    ...rawBody,
    status: rawBody.status ?? rawBody.toStatus!,
  }
  expect(body.operationId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  )
  return body
}
