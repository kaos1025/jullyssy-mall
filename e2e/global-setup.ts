import { test as setup } from "@playwright/test"
import {
  ensureTestUser,
  cleanupAllE2E,
} from "./helpers/supabase-admin"
import { TEST_USER, TEST_ADMIN } from "./helpers/test-data"
import path from "path"

const authDir = path.join(__dirname, ".auth")

const login = async (
  browser: import("@playwright/test").Browser,
  email: string,
  password: string,
  savePath: string
) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  // 로그인 페이지 로드
  await page.goto("/login", { waitUntil: "domcontentloaded" })

  // input이 interactive 상태인지 확인
  const emailInput = page.locator("#email")
  const passwordInput = page.locator("#password")
  await emailInput.waitFor({ state: "visible", timeout: 10_000 })

  // 기존 값 클리어 후 입력 (React controlled input 대응)
  await emailInput.click()
  await emailInput.fill(email)
  await passwordInput.click()
  await passwordInput.fill(password)

  // 입력값 확인 후 제출
  await page.locator('button[type="submit"]').click()

  // 두 가지 시나리오 대기: 네비게이션 성공 또는 에러 토스트
  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 15_000,
      waitUntil: "commit",
    })
  } catch {
    // URL이 안 바뀌었으면 에러 확인
    const pageContent = await page.content()
    const hasError = pageContent.includes("로그인 실패")
    if (hasError) {
      await context.close()
      throw new Error(`로그인 실패 (${email}): 인증 에러`)
    }
    // URL은 안 바뀌었지만 에러도 없으면 — 쿠키는 설정됐을 수 있음
    // router.push가 soft navigation이라 URL 변경을 감지 못할 수 있으므로
    // 직접 / 로 이동
    await page.goto("/", { waitUntil: "domcontentloaded" })
    // 다시 /login으로 리다이렉트 되면 로그인 실패
    if (page.url().includes("/login")) {
      await context.close()
      throw new Error(`로그인 실패 (${email}): 세션이 설정되지 않음`)
    }
  }

  await context.storageState({ path: savePath })
  await context.close()
}

setup("전체 E2E 데이터 초기화 + 로그인 상태 저장", async ({ browser }) => {
  // 1. 이전 실행 잔여 데이터 정리
  await cleanupAllE2E()

  // 2. 테스트 유저 생성 (email_confirm: true)
  await ensureTestUser(TEST_USER.email, TEST_USER.password, TEST_USER.name)
  await ensureTestUser(TEST_ADMIN.email, TEST_ADMIN.password, TEST_ADMIN.name)

  // 3. 일반 유저 로그인 → storageState 저장
  await login(
    browser,
    TEST_USER.email,
    TEST_USER.password,
    path.join(authDir, "user.json")
  )

  // 4. 어드민 유저 로그인 → storageState 저장
  await login(
    browser,
    TEST_ADMIN.email,
    TEST_ADMIN.password,
    path.join(authDir, "admin.json")
  )
})
