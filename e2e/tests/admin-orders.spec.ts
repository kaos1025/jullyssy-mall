import { test, expect } from "../fixtures/auth.fixture"
import {
  createTestProduct,
  createTestOrder,
  cleanupByPrefix,
  getUserIdByEmail,
  adminClient,
} from "../helpers/supabase-admin"
import { PREFIXES, TEST_USER } from "../helpers/test-data"

const PREFIX = PREFIXES.adminOrder

let testOrderIds: string[] = []

test.describe("어드민 주문 관리", () => {
  test.beforeAll(async () => {
    await cleanupByPrefix(PREFIX)

    // 테스트 상품 생성
    const product = await createTestProduct({
      name: `${PREFIX} 테스트 블라우스`,
      price: 45000,
      options: [{ color: "화이트", size: "M", stock: 20 }],
    })

    const userId = await getUserIdByEmail(TEST_USER.email)
    if (!userId) throw new Error("Test user not found")

    // PAID 상태 주문 2건 생성
    for (let i = 0; i < 2; i++) {
      const order = await createTestOrder({
        userId,
        productName: `${PREFIX} 테스트 블라우스`,
        totalAmount: 45000,
        paidAmount: 45000,
        status: "PAID",
        items: [
          {
            productId: product.id,
            productName: `${PREFIX} 테스트 블라우스`,
            color: "화이트",
            size: "M",
            price: 45000,
            quantity: 1,
          },
        ],
      })
      testOrderIds.push(order.id)
    }
  })

  test.afterAll(async () => {
    // 주문 정리
    if (testOrderIds.length) {
      await adminClient.from("order_items").delete().in("order_id", testOrderIds)
      await adminClient.from("orders").delete().in("id", testOrderIds)
    }
    await cleanupByPrefix(PREFIX)
    testOrderIds = []
  })

  test("주문 관리 페이지 로드 + 목록 표시", async ({ adminPage: page }) => {
    await page.goto("/admin/orders")
    await expect(page.getByText("주문 관리")).toBeVisible({ timeout: 10_000 })

    // 주문 테이블에 데이터가 표시되는지 확인
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test("상태 탭 필터 — 결제완료", async ({ adminPage: page }) => {
    await page.goto("/admin/orders")
    await expect(page.getByText("주문 관리")).toBeVisible({ timeout: 10_000 })

    // "결제완료" 탭 클릭
    await page.getByRole("tab", { name: "결제완료" }).click()

    // 주문이 표시되는지 확인 (E2E 주문의 수령인)
    await expect(page.getByText("E2E테스트수령인").first()).toBeVisible({
      timeout: 10_000,
    })
  })

  test("주문 상태 변경: PAID → 상품준비중", async ({ adminPage: page }) => {
    await page.goto("/admin/orders")
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 10_000,
    })

    // 첫 번째 주문의 상태 드롭다운 클릭
    const firstRow = page.locator("table tbody tr").first()
    const statusTrigger = firstRow.locator('[role="combobox"]')
    await statusTrigger.click()

    // "상품준비중" 선택
    await page.getByRole("option", { name: "상품준비중" }).click()

    // 토스트 확인
    await expect(page.getByText("상품준비중")).toBeVisible({ timeout: 5_000 })
  })

  test("송장번호 입력 → 배송중 전환", async ({ adminPage: page }) => {
    await page.goto("/admin/orders")
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 10_000,
    })

    // "송장" 버튼 클릭
    await page.getByRole("button", { name: "송장" }).first().click()

    // 다이얼로그 표시 확인
    await expect(page.getByText("송장번호 입력")).toBeVisible()

    // 택배사는 기본값 (CJ대한통운) 사용
    // 송장번호 입력
    await page.getByPlaceholder("송장번호 입력").fill("1234567890")

    // 등록 버튼 클릭
    await page.getByRole("button", { name: "등록" }).click()

    // 성공 토스트
    await expect(page.getByText("송장번호 등록 완료")).toBeVisible({
      timeout: 5_000,
    })
  })

  test("일괄 상태 변경", async ({ adminPage: page }) => {
    await page.goto("/admin/orders")
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 10_000,
    })

    // 전체 선택 체크박스 클릭
    const selectAllCheckbox = page.locator("thead input[type='checkbox']")
    await selectAllCheckbox.click()

    // "준비중" 일괄 변경 버튼 표시 확인 + 클릭
    const bulkButton = page.getByRole("button", { name: /준비중/ })
    await expect(bulkButton).toBeVisible()
    await bulkButton.click()

    // 토스트 확인
    await expect(page.getByText(/건 상태 변경/)).toBeVisible({
      timeout: 5_000,
    })
  })

  test("CSV 다운로드", async ({ adminPage: page }) => {
    await page.goto("/admin/orders")
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 10_000,
    })

    // 다운로드 이벤트 리스닝
    const downloadPromise = page.waitForEvent("download")

    // CSV 다운로드 버튼 클릭
    await page.getByRole("button", { name: "CSV 다운로드" }).click()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^orders_\d{8}\.csv$/)
  })
})
