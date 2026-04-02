import { test, expect } from "@playwright/test"
import {
  ensureTestUser,
  deleteTestUser,
} from "../helpers/supabase-admin"
import { TEST_USER, TEST_ADMIN, PREFIXES } from "../helpers/test-data"
import { SEL } from "../helpers/selectors"

test.describe("인증 플로우", () => {
  // --- 회원가입 ---

  test("이메일 회원가입", async ({ page }) => {
    const randomEmail = `e2e-signup-${Date.now()}@test.jullyssy.com`

    await page.goto("/signup")
    await expect(page.locator("text=회원가입").first()).toBeVisible()

    await page.locator(SEL.emailInput).fill(randomEmail)
    await page.locator(SEL.passwordInput).fill("TestPass123!")
    await page.locator(SEL.passwordConfirmInput).fill("TestPass123!")
    await page.locator(SEL.nameInput).fill(`${PREFIXES.auth} 테스트유저`)
    await page.locator(SEL.phoneInput).fill("01099998888")

    await page.locator(SEL.signupButton).click()

    // 성공 토스트 또는 /login 리다이렉트 확인
    await expect(
      page.getByText("회원가입 완료").or(page.locator('input#email'))
    ).toBeVisible({ timeout: 10_000 })

    // cleanup
    await deleteTestUser(randomEmail)
  })

  test("비밀번호 불일치 시 회원가입 실패", async ({ page }) => {
    await page.goto("/signup")

    await page.locator(SEL.emailInput).fill("mismatch@test.jullyssy.com")
    await page.locator(SEL.passwordInput).fill("TestPass123!")
    await page.locator(SEL.passwordConfirmInput).fill("DifferentPass!")
    await page.locator(SEL.nameInput).fill("테스트")

    await page.locator(SEL.signupButton).click()

    await expect(page.getByText("비밀번호 불일치")).toBeVisible()
  })

  // --- 로그인 ---

  test("이메일 로그인 성공", async ({ page }) => {
    // 테스트 유저가 global-setup에서 생성됨
    await page.goto("/login")

    await page.locator(SEL.emailInput).fill(TEST_USER.email)
    await page.locator(SEL.passwordInput).fill(TEST_USER.password)
    await page.locator(SEL.loginButton).click()

    // 홈으로 리다이렉트
    await expect(page).toHaveURL("/", { timeout: 10_000 })
  })

  test("잘못된 비밀번호로 로그인 실패", async ({ page }) => {
    await page.goto("/login")

    await page.locator(SEL.emailInput).fill(TEST_USER.email)
    await page.locator(SEL.passwordInput).fill("WrongPassword!")
    await page.locator(SEL.loginButton).click()

    await expect(page.getByText("로그인 실패")).toBeVisible({ timeout: 5_000 })
  })

  // --- 소셜 로그인 버튼 ---

  test("카카오 로그인 버튼 존재 확인", async ({ page }) => {
    await page.goto("/login")

    await expect(page.locator(SEL.kakaoButton)).toBeVisible()
    await expect(page.getByText("네이버로 시작하기")).toBeVisible()
  })

  // --- 보호 경로 리다이렉트 ---

  test("비로그인 시 /mypage → /login 리다이렉트", async ({ browser }) => {
    // 비로그인 상태의 새 컨텍스트
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto("/mypage")

    await expect(page).toHaveURL(/\/login.*redirect/, { timeout: 10_000 })
    await context.close()
  })

  test("비로그인 시 /checkout → /login 리다이렉트", async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto("/checkout")

    await expect(page).toHaveURL(/\/login.*redirect/, { timeout: 10_000 })
    await context.close()
  })

  // --- 어드민 접근 제어 ---

  test("일반 유저로 /admin 접근 시 홈으로 리다이렉트", async ({ browser }) => {
    // 일반 유저 storageState 사용
    const context = await browser.newContext({
      storageState: "e2e/.auth/user.json",
    })
    const page = await context.newPage()

    await page.goto("/admin")

    // 어드민 이메일이 아니므로 / 로 리다이렉트
    await expect(page).toHaveURL("/", { timeout: 10_000 })
    await context.close()
  })

  test("어드민 유저로 /admin 접근 성공", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/admin.json",
    })
    const page = await context.newPage()

    await page.goto("/admin")

    // 어드민 레이아웃 표시 확인
    await expect(page.getByText("대시보드")).toBeVisible({ timeout: 10_000 })
    await context.close()
  })

  // --- 이미 로그인 시 인증 페이지 리다이렉트 ---

  test("로그인 상태에서 /login 접근 시 홈으로 리다이렉트", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: "e2e/.auth/user.json",
    })
    const page = await context.newPage()

    await page.goto("/login")

    await expect(page).toHaveURL("/", { timeout: 10_000 })
    await context.close()
  })
})
