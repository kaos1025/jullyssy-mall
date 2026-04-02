import { test as setup, expect } from "@playwright/test"
import {
  ensureTestUser,
  cleanupAllE2E,
} from "./helpers/supabase-admin"
import { TEST_USER, TEST_ADMIN } from "./helpers/test-data"
import path from "path"

const authDir = path.join(__dirname, ".auth")

setup("전체 E2E 데이터 초기화 + 로그인 상태 저장", async ({ browser }) => {
  // 1. 이전 실행 잔여 데이터 정리
  await cleanupAllE2E()

  // 2. 테스트 유저 생성 (email_confirm: true)
  await ensureTestUser(TEST_USER.email, TEST_USER.password, TEST_USER.name)
  await ensureTestUser(TEST_ADMIN.email, TEST_ADMIN.password, TEST_ADMIN.name)

  // 3. 일반 유저 로그인 → storageState 저장
  const userContext = await browser.newContext()
  const userPage = await userContext.newPage()

  await userPage.goto("/login")
  await userPage.locator("#email").fill(TEST_USER.email)
  await userPage.locator("#password").fill(TEST_USER.password)
  await userPage.locator('button[type="submit"]').click()
  await userPage.waitForURL("/", { timeout: 10_000 })
  await expect(userPage).toHaveURL("/")

  await userContext.storageState({ path: path.join(authDir, "user.json") })
  await userContext.close()

  // 4. 어드민 유저 로그인 → storageState 저장
  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()

  await adminPage.goto("/login")
  await adminPage.locator("#email").fill(TEST_ADMIN.email)
  await adminPage.locator("#password").fill(TEST_ADMIN.password)
  await adminPage.locator('button[type="submit"]').click()
  await adminPage.waitForURL("/", { timeout: 10_000 })
  await expect(adminPage).toHaveURL("/")

  await adminContext.storageState({ path: path.join(authDir, "admin.json") })
  await adminContext.close()
})
