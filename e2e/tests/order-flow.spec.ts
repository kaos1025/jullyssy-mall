import { test, expect } from "../fixtures/auth.fixture"
import {
  createTestProduct,
  cleanupByPrefix,
  adminClient,
} from "../helpers/supabase-admin"
import { PREFIXES, TEST_ADDRESS } from "../helpers/test-data"
import { injectCart } from "../helpers/cart"

const PREFIX = PREFIXES.order

let testProduct: { id: string; name: string; price: number }
let testOptionId: string

const makeCartItem = () => ({
  product_id: testProduct.id,
  product_option_id: testOptionId,
  product_name: testProduct.name,
  product_image: null,
  color: "블랙",
  size: "M",
  price: 35000,
  extra_price: 0,
  quantity: 1,
  stock: 10,
})

test.describe("주문 결제 플로우", () => {
  test.beforeAll(async () => {
    await cleanupByPrefix(PREFIX)

    const product = await createTestProduct({
      name: `${PREFIX} 니트 원피스`,
      price: 35000,
      options: [
        { color: "블랙", size: "M", stock: 10 },
        { color: "블랙", size: "L", stock: 5 },
        { color: "아이보리", size: "M", stock: 3 },
      ],
    })

    testProduct = { id: product.id, name: product.name, price: product.price }

    const { data: opts } = await adminClient
      .from("product_options")
      .select("id")
      .eq("product_id", product.id)
      .eq("color", "블랙")
      .eq("size", "M")
      .single()

    testOptionId = opts!.id
  })

  test.afterAll(async () => {
    await cleanupByPrefix(PREFIX)
    const { data: orders } = await adminClient
      .from("orders")
      .select("id")
      .like("order_no", "E2E-%")
    if (orders?.length) {
      const ids = orders.map((o) => o.id)
      await adminClient.from("order_items").delete().in("order_id", ids)
      await adminClient.from("orders").delete().in("id", ids)
    }
  })

  test("상품 목록에서 상품이 표시됨", async ({ userPage: page }) => {
    await page.goto("/products")
    await expect(page.getByText(testProduct.name)).toBeVisible({
      timeout: 10_000,
    })
  })

  test("상품 상세 → 옵션 선택 → 장바구니 추가", async ({ userPage: page }) => {
    await page.goto(`/products/${testProduct.id}`)
    await expect(page.getByText(testProduct.name)).toBeVisible({
      timeout: 10_000,
    })

    // 색상 선택: 블랙
    await page.getByRole("button", { name: "블랙", exact: true }).click()

    // 사이즈 선택: M (정확히 "M"만 매칭)
    await page.getByRole("button", { name: "M", exact: true }).click()

    // 선택된 옵션 표시
    await expect(page.getByText("블랙 / M")).toBeVisible()

    // 장바구니 추가
    await page.locator("button:has-text('장바구니')").first().click()

    await expect(page.getByText("장바구니에 추가했습니다")).toBeVisible({
      timeout: 5_000,
    })
  })

  test("장바구니 페이지에서 상품 확인", async ({ userPage: page }) => {
    await injectCart(page, [makeCartItem()])
    await page.goto("/cart")

    await expect(page.getByText(testProduct.name)).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText("블랙 / M")).toBeVisible()
    await expect(page.getByText("35,000원").first()).toBeVisible()
  })

  test("장바구니 수량 변경", async ({ userPage: page }) => {
    await injectCart(page, [makeCartItem()])
    await page.goto("/cart")

    await expect(page.getByText(testProduct.name)).toBeVisible({
      timeout: 10_000,
    })

    // + 버튼
    const plusButton = page
      .locator("button")
      .filter({ has: page.locator(".lucide-plus") })
    await plusButton.click()

    await expect(page.locator("span.w-8.text-center").first()).toHaveText("2")
    await expect(page.getByText("70,000원").first()).toBeVisible()
  })

  test("장바구니 상품 삭제", async ({ userPage: page }) => {
    await injectCart(page, [makeCartItem()])
    await page.goto("/cart")

    await expect(page.getByText(testProduct.name)).toBeVisible({
      timeout: 10_000,
    })

    const deleteButton = page
      .locator("button")
      .filter({ has: page.locator(".lucide-trash-2") })
    await deleteButton.click()

    await expect(page.getByText("장바구니가 비어있습니다")).toBeVisible()
  })

  test("장바구니 → 주문서 이동", async ({ userPage: page }) => {
    await injectCart(page, [makeCartItem()])
    await page.goto("/cart")

    await expect(page.getByText(testProduct.name)).toBeVisible({
      timeout: 10_000,
    })

    await page.locator("button:has-text('주문하기')").click()
    await expect(page).toHaveURL("/checkout", { timeout: 10_000 })
  })

  test("체크아웃 — 배송지 입력 + 결제 직전까지", async ({ userPage: page }) => {
    // 다음 우편번호 API 모킹
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).daum = {
        Postcode: class {
          config: { oncomplete: (data: unknown) => void }
          constructor(config: { oncomplete: (data: unknown) => void }) {
            this.config = config
          }
          open() {
            this.config.oncomplete({
              zonecode: "06234",
              roadAddress: "서울 강남구 테헤란로 123",
            })
          }
        },
      }
    })

    await injectCart(page, [makeCartItem()])
    await page.goto("/checkout")

    await expect(page.getByText("주문서")).toBeVisible({ timeout: 10_000 })

    // 배송지 입력
    await page.getByPlaceholder("이름").fill(TEST_ADDRESS.recipient)
    await page.getByPlaceholder("010-0000-0000").fill(TEST_ADDRESS.phone)
    await page.getByText("주소검색").click()

    await expect(page.getByPlaceholder("우편번호")).toHaveValue("06234")
    await expect(page.getByPlaceholder("기본주소")).toHaveValue(
      "서울 강남구 테헤란로 123"
    )
    await page.getByPlaceholder("상세주소 입력").fill(TEST_ADDRESS.address2)

    await expect(page.getByText("신용카드")).toBeVisible()
    await expect(page.getByText("38,000원 결제하기")).toBeVisible()

    // POST /api/orders 인터셉트
    const orderRequestPromise = page.waitForRequest(
      (req) => req.url().includes("/api/orders") && req.method() === "POST"
    )

    // 토스페이먼츠 SDK 차단
    await page.route("**/tosspayments**", (route) => route.abort())

    await page.getByText("38,000원 결제하기").click()

    const orderRequest = await orderRequestPromise
    const body = orderRequest.postDataJSON()
    expect(body.items).toHaveLength(1)
    expect(body.items[0].product_id).toBe(testProduct.id)
    expect(body.address.recipient).toBe(TEST_ADDRESS.recipient)
    expect(body.shipping_fee).toBe(3000)
  })
})
