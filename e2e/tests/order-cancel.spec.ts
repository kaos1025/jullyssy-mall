import { test, expect } from "../fixtures/auth.fixture"
import {
  createTestProduct,
  createTestOrder,
  cleanupByPrefix,
  getUserIdByEmail,
  adminClient,
} from "../helpers/supabase-admin"
import { PREFIXES, TEST_USER } from "../helpers/test-data"

const PREFIX = PREFIXES.orderCancel

let testUserId: string
let testOrderId: string
let testOrderNo: string

test.describe("주문 취소", () => {
  test.beforeAll(async () => {
    await cleanupByPrefix(PREFIX)

    // E2E 주문 잔여분 정리
    const { data: oldOrders } = await adminClient
      .from("orders")
      .select("id")
      .like("order_no", "E2E-%")
    if (oldOrders?.length) {
      const ids = oldOrders.map((o) => o.id)
      await adminClient.from("order_items").delete().in("order_id", ids)
      await adminClient.from("orders").delete().in("id", ids)
    }

    testUserId = (await getUserIdByEmail(TEST_USER.email))!
    if (!testUserId) throw new Error("Test user not found")

    // 테스트 상품 생성
    const product = await createTestProduct({
      name: `${PREFIX} 취소테스트 블라우스`,
      price: 29000,
      options: [{ color: "화이트", size: "FREE", stock: 10 }],
    })

    const { data: opts } = await adminClient
      .from("product_options")
      .select("id")
      .eq("product_id", product.id)
      .single()

    // PAID 상태 주문 생성 (payment_key 없음 → 토스 API 호출 안 함)
    const order = await createTestOrder({
      userId: testUserId,
      productName: `${PREFIX} 취소테스트 블라우스`,
      totalAmount: 29000,
      paidAmount: 32000,
      status: "PAID",
      items: [
        {
          productId: product.id,
          productOptionId: opts!.id,
          productName: `${PREFIX} 취소테스트 블라우스`,
          color: "화이트",
          size: "FREE",
          price: 29000,
          quantity: 1,
        },
      ],
    })

    testOrderId = order.id
    testOrderNo = order.order_no
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

  test("주문 목록에서 주문 확인", async ({ userPage: page }) => {
    await page.goto("/mypage/orders")

    // E2E 주문번호 표시 확인
    await expect(page.getByText(testOrderNo)).toBeVisible({ timeout: 10_000 })

    // 결제완료 뱃지 확인
    await expect(page.getByText("결제완료").first()).toBeVisible()
  })

  test("주문 상세에서 취소 → 다이얼로그 → 취소 완료", async ({
    userPage: page,
  }) => {
    // 주문 상세 페이지로 직접 이동 (목록의 Link 클릭 이슈 회피)
    await page.goto(`/mypage/orders/${testOrderId}`)

    // 주문 상세 로드 확인
    await expect(page.getByText("주문 상세")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(testOrderNo)).toBeVisible()
    await expect(page.getByText("결제완료")).toBeVisible()

    // "취소 신청" 버튼 클릭
    await page
      .getByRole("button", { name: "취소 신청", exact: true })
      .click()

    // 다이얼로그 확인
    await expect(
      page.getByRole("heading", { name: "주문을 취소하시겠습니까?" })
    ).toBeVisible({ timeout: 5_000 })

    // 다이얼로그 내 "취소 신청" 클릭 (destructive 버튼)
    const dialog = page.locator("[role=dialog]")
    await dialog.getByRole("button", { name: "취소 신청" }).click()

    // 성공 토스트 확인
    await expect(
      page.getByText("취소 신청 완료", { exact: true }).first()
    ).toBeVisible({ timeout: 10_000 })

    // 페이지 갱신 후 취소완료 뱃지 확인
    await expect(page.getByText("취소완료").first()).toBeVisible({
      timeout: 10_000,
    })

    // 취소 신청 버튼이 더 이상 보이지 않아야 함
    await expect(
      page.getByRole("button", { name: "취소 신청" })
    ).toHaveCount(0)
  })
})
