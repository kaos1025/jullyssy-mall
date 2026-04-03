import { test as base, type Page } from "@playwright/test"
import path from "path"

const authDir = path.join(__dirname, "..", ".auth")

/**
 * global-setup에서 저장한 storageState를 사용하는 fixture.
 * 프로젝트 레벨 storageState 대신 fixture에서 직접 context를 생성합니다.
 */
export const test = base.extend<{
  userPage: Page
  adminPage: Page
}>({
  userPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "user.json"),
    })
    const page = await context.newPage()
    // 미들웨어가 세션을 갱신하도록 한번 방문
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await use(page)
    await context.close()
  },

  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "admin.json"),
    })
    const page = await context.newPage()
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await use(page)
    await context.close()
  },
})

export { expect } from "@playwright/test"
