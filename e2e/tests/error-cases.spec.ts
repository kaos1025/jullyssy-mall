import { test, expect } from "../fixtures/auth.fixture"
import {
  createTestProduct,
  cleanupByPrefix,
  cleanupCartItems,
  getUserIdByEmail,
} from "../helpers/supabase-admin"
import { PREFIXES, TEST_USER } from "../helpers/test-data"

const PREFIX = PREFIXES.errorCase

let testProductId: string
let testUserId: string

test.describe("에러 케이스", () => {
  test.beforeAll(async () => {
    await cleanupByPrefix(PREFIX)

    testUserId = (await getUserIdByEmail(TEST_USER.email))!
    if (!testUserId) throw new Error("Test user not found")

    // 품절 옵션 포함 상품 생성
    const product = await createTestProduct({
      name: `${PREFIX} 품절테스트 니트`,
      price: 39000,
      options: [
        { color: "블랙", size: "S", stock: 0 }, // 품절
        { color: "블랙", size: "M", stock: 5 }, // 재고 있음
        { color: "레드", size: "S", stock: 0 }, // 전체 품절
        { color: "레드", size: "M", stock: 0 }, // 전체 품절
      ],
    })

    testProductId = product.id
  })

  test.afterAll(async () => {
    await cleanupCartItems(testUserId)
    await cleanupByPrefix(PREFIX)
  })

  test("전체 색상 품절 시 색상 버튼 비활성화 (레드)", async ({
    userPage: page,
  }) => {
    await page.goto(`/products/${testProductId}`)

    await expect(page.getByText(`${PREFIX} 품절테스트 니트`)).toBeVisible({
      timeout: 10_000,
    })

    // 레드 색상 — 모든 사이즈 품절이므로 버튼 비활성화
    const redButton = page.getByRole("button", { name: "레드", exact: true })
    await expect(redButton).toBeVisible()
    await expect(redButton).toBeDisabled()
  })

  test("특정 사이즈 품절 시 사이즈 버튼 비활성화 (블랙/S)", async ({
    userPage: page,
  }) => {
    await page.goto(`/products/${testProductId}`)

    await expect(page.getByText(`${PREFIX} 품절테스트 니트`)).toBeVisible({
      timeout: 10_000,
    })

    // 블랙 선택 (재고 있는 사이즈 존재)
    await page.getByRole("button", { name: "블랙", exact: true }).click()

    // 사이즈 영역 표시
    await expect(page.getByText("사이즈")).toBeVisible({ timeout: 5_000 })

    // S 사이즈 — 품절이므로 비활성화 (stock=0, 뱃지 없음)
    const sizeS = page.getByRole("button", { name: "S", exact: true })
    await expect(sizeS).toBeDisabled()

    // M 사이즈 — 재고 있으므로 활성화 (내부에 "5개" 뱃지 → accessible name이 "M 5개")
    const sizeM = page.getByRole("button", { name: /^M/ })
    await expect(sizeM).toBeEnabled()
  })

  test("빈 장바구니로 /checkout 진입 시 안내 메시지", async ({
    userPage: page,
  }) => {
    // 장바구니 비우기
    await cleanupCartItems(testUserId)

    await page.goto("/checkout")

    await expect(page.getByText("주문서")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText("주문할 상품이 없습니다")).toBeVisible({
      timeout: 5_000,
    })
  })
})
