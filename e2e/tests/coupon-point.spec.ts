import { test, expect } from "../fixtures/auth.fixture"
import {
  createTestProduct,
  createTestCoupon,
  issueCouponToUser,
  setUserPoint,
  cleanupByPrefix,
  getUserIdByEmail,
  adminClient,
} from "../helpers/supabase-admin"
import { PREFIXES, TEST_USER } from "../helpers/test-data"
import { injectCart } from "../helpers/cart"

const PREFIX = PREFIXES.coupon

let testProduct: { id: string; name: string; price: number }
let testOptionId: string
let testUserId: string
let testCouponId: string

test.describe("쿠폰 + 포인트 결제", () => {
  test.beforeAll(async () => {
    await cleanupByPrefix(PREFIX)

    testUserId = (await getUserIdByEmail(TEST_USER.email))!
    if (!testUserId) throw new Error("Test user not found")

    // 테스트 상품 생성 (60000원 — 무료배송 대상)
    const product = await createTestProduct({
      name: `${PREFIX} 캐시미어 코트`,
      price: 60000,
      options: [{ color: "베이지", size: "FREE", stock: 10 }],
    })
    testProduct = { id: product.id, name: product.name, price: product.price }

    const { data: opts } = await adminClient
      .from("product_options")
      .select("id")
      .eq("product_id", product.id)
      .single()
    testOptionId = opts!.id

    // FIXED 쿠폰 (5000원, 최소 30000원)
    const coupon = await createTestCoupon({
      name: `${PREFIX} 5천원 할인 쿠폰`,
      code: "E2E_COUPON_FIXED_5000",
      type: "FIXED",
      discountValue: 5000,
      minOrderAmount: 30000,
    })
    testCouponId = coupon.id

    // 유저에게 쿠폰 발급
    await issueCouponToUser(testUserId, testCouponId)

    // 유저 포인트 10000P 설정
    await setUserPoint(testUserId, 10000)
  })

  test.afterAll(async () => {
    await cleanupByPrefix(PREFIX)
    // 포인트 원복
    await adminClient
      .from("profiles")
      .update({ point: 0 })
      .eq("id", testUserId)
  })

  const getCartItems = () => [
    {
      product_id: testProduct.id,
      product_option_id: testOptionId,
      product_name: testProduct.name,
      product_image: null,
      color: "베이지",
      size: "FREE",
      price: 60000,
      extra_price: 0,
      quantity: 1,
      stock: 10,
    },
  ]

  test("쿠폰 적용 시 할인 금액 반영", async ({ userPage: page }) => {
    await page.goto("/")
    await injectCart(page, getCartItems())
    await page.goto("/checkout")

    await expect(page.getByText("주문서")).toBeVisible({ timeout: 10_000 })

    // 쿠폰 선택 버튼 클릭
    await page.getByText(/쿠폰 선택/).click()

    // 쿠폰 다이얼로그 표시
    await expect(page.getByText("쿠폰 선택").nth(1)).toBeVisible()

    // 쿠폰 선택 (5000원 할인)
    await page.getByText(`${PREFIX} 5천원 할인 쿠폰`).click()

    // 할인 금액 표시 확인
    await expect(page.getByText("-5,000원").first()).toBeVisible()

    // 최종 결제금액 확인 (60000 - 5000 = 55000, 무료배송)
    await expect(page.getByText("55,000원 결제하기")).toBeVisible()
  })

  test("쿠폰 취소", async ({ userPage: page }) => {
    await page.goto("/")
    await injectCart(page, getCartItems())
    await page.goto("/checkout")

    await expect(page.getByText("주문서")).toBeVisible({ timeout: 10_000 })

    // 쿠폰 적용
    await page.getByText(/쿠폰 선택/).click()
    await page.getByText(`${PREFIX} 5천원 할인 쿠폰`).click()
    await expect(page.getByText("-5,000원").first()).toBeVisible()

    // 쿠폰 취소
    await page.getByRole("button", { name: "취소" }).click()

    // 원래 금액으로 복원 (60000원)
    await expect(page.getByText("60,000원 결제하기")).toBeVisible()
  })

  test("포인트 사용", async ({ userPage: page }) => {
    await page.goto("/")
    await injectCart(page, getCartItems())
    await page.goto("/checkout")

    await expect(page.getByText("주문서")).toBeVisible({ timeout: 10_000 })

    // 보유 포인트 확인
    await expect(page.getByText("보유 10,000P")).toBeVisible()

    // 3000P 입력
    const pointInput = page.getByPlaceholder(/최소/)
    await pointInput.fill("3000")

    // 적용 클릭
    await page.getByRole("button", { name: "적용" }).click()

    // 포인트 할인 표시
    await expect(page.getByText("-3,000원").first()).toBeVisible()

    // 최종 금액 (60000 - 3000 = 57000)
    await expect(page.getByText("57,000원 결제하기")).toBeVisible()
  })

  test("포인트 전액사용", async ({ userPage: page }) => {
    await page.goto("/")
    await injectCart(page, getCartItems())
    await page.goto("/checkout")

    await expect(page.getByText("주문서")).toBeVisible({ timeout: 10_000 })

    // 전액사용 클릭
    await page.getByRole("button", { name: "전액사용" }).click()

    // max = min(10000, floor(60000 * 0.5)) = min(10000, 30000) = 10000
    const pointInput = page.getByPlaceholder(/최소/)
    await expect(pointInput).toHaveValue("10000")

    // 포인트 할인 표시
    await expect(page.getByText("-10,000원").first()).toBeVisible()

    // 최종 금액 (60000 - 10000 = 50000)
    await expect(page.getByText("50,000원 결제하기")).toBeVisible()
  })

  test("쿠폰 + 포인트 동시 적용", async ({ userPage: page }) => {
    await page.goto("/")
    await injectCart(page, getCartItems())
    await page.goto("/checkout")

    await expect(page.getByText("주문서")).toBeVisible({ timeout: 10_000 })

    // 1. 쿠폰 적용 (5000원)
    await page.getByText(/쿠폰 선택/).click()
    await page.getByText(`${PREFIX} 5천원 할인 쿠폰`).click()
    await expect(page.getByText("-5,000원").first()).toBeVisible()

    // 2. 포인트 입력 (3000P)
    const pointInput = page.getByPlaceholder(/최소/)
    await pointInput.fill("3000")
    await page.getByRole("button", { name: "적용" }).click()

    // 쿠폰 -5000 + 포인트 -3000 = 총 할인 8000
    // 최종 = 60000 - 5000 - 3000 = 52000 (무료배송)
    await expect(page.getByText("52,000원 결제하기")).toBeVisible()
  })
})
