import { test, expect } from "@playwright/test"
import {
  createTestProduct,
  cleanupByPrefix,
  adminClient,
} from "../helpers/supabase-admin"
import { PREFIXES } from "../helpers/test-data"

const PREFIX = PREFIXES.guestCart

let testProductId: string

// auth-tests 프로젝트: storageState 없는 비로그인 상태

test.describe("비로그인 장바구니", () => {
  test.beforeAll(async () => {
    await cleanupByPrefix(PREFIX)

    const product = await createTestProduct({
      name: `${PREFIX} 게스트 테스트 원피스`,
      price: 45000,
      options: [
        { color: "블랙", size: "M", stock: 10 },
        { color: "블랙", size: "L", stock: 5 },
      ],
    })

    testProductId = product.id
  })

  test.afterAll(async () => {
    await cleanupByPrefix(PREFIX)
  })

  test("상품 상세에서 장바구니 추가 시 /login 리다이렉트", async ({
    page,
  }) => {
    await page.goto(`/products/${testProductId}`)

    // 상품명 확인
    await expect(page.getByText(`${PREFIX} 게스트 테스트 원피스`)).toBeVisible({
      timeout: 10_000,
    })

    // 색상 선택
    await page.getByRole("button", { name: "블랙", exact: true }).click()

    // 사이즈 선택
    await expect(page.getByText("사이즈")).toBeVisible({ timeout: 5_000 })
    await page.getByRole("button", { name: "M", exact: true }).click()

    // 선택된 옵션 표시 확인
    await expect(page.getByText("블랙 / M")).toBeVisible({ timeout: 5_000 })

    // 장바구니 클릭 → /login 리다이렉트
    await page.locator("button:has-text('장바구니')").first().click()

    await expect(page).toHaveURL(/\/login.*redirect/, { timeout: 10_000 })
  })

  test("비로그인 /cart 접속 → 빈 장바구니 표시", async ({ page }) => {
    await page.goto("/cart")

    // API 401 → items 빈 배열 → 빈 장바구니 표시
    await expect(page.getByText("장바구니가 비어있습니다")).toBeVisible({
      timeout: 10_000,
    })

    // "쇼핑하러 가기" 버튼 존재
    await expect(page.getByRole("link", { name: "쇼핑하러 가기" })).toBeVisible()
  })

  test("비로그인 /checkout 접속 → /login 리다이렉트", async ({ page }) => {
    await page.goto("/checkout")

    // 미들웨어에서 /login으로 리다이렉트
    await expect(page).toHaveURL(/\/login.*redirect/, { timeout: 10_000 })
  })
})
