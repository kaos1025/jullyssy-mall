import { test as base, type Page } from "@playwright/test"
import path from "path"

const authDir = path.join(__dirname, "..", ".auth")

/**
 * 인증 상태가 주입된 커스텀 fixture.
 * - userPage: 일반 유저 로그인 상태
 * - adminPage: 어드민 유저 로그인 상태
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
    await use(page)
    await context.close()
  },

  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "admin.json"),
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

export { expect } from "@playwright/test"
