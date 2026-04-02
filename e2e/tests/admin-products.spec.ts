import { test, expect } from "../fixtures/auth.fixture"
import { cleanupByPrefix } from "../helpers/supabase-admin"
import { PREFIXES } from "../helpers/test-data"

const PREFIX = PREFIXES.adminProd

test.describe("어드민 상품 관리", () => {
  test.beforeAll(async () => {
    await cleanupByPrefix(PREFIX)
  })

  test.afterAll(async () => {
    await cleanupByPrefix(PREFIX)
  })

  test("상품 관리 페이지 로드", async ({ adminPage: page }) => {
    await page.goto("/admin/products")
    await expect(page.getByText("상품 관리")).toBeVisible({ timeout: 10_000 })
    // 테이블 헤더 확인
    await expect(page.getByText("상품명").first()).toBeVisible()
  })

  test("상품 등록", async ({ adminPage: page }) => {
    await page.goto("/admin/products/new")
    await expect(page.getByText("기본 정보")).toBeVisible({ timeout: 10_000 })

    // 상품명 입력
    const nameInput = page.getByLabel("상품명 *")
    await nameInput.fill(`${PREFIX} 테스트 니트`)

    // 정가 입력
    const priceInput = page.getByLabel("정가 *")
    await priceInput.fill("29000")

    // 할인가 입력
    const salePriceInput = page.getByLabel("할인가")
    await salePriceInput.fill("19000")

    // 옵션 입력 (첫 번째 행이 이미 존재)
    const optionSection = page.locator("text=옵션 관리").locator("..")
    const colorInputs = page.getByPlaceholder("색상")
    const sizeInputs = page.getByPlaceholder("사이즈")
    const stockInputs = page.getByPlaceholder("재고")

    await colorInputs.first().fill("블랙")
    await sizeInputs.first().fill("FREE")
    await stockInputs.first().fill("100")

    // 저장 버튼
    await page.locator('button[type="submit"]').click()

    // 성공 토스트 + 목록으로 리다이렉트
    await expect(
      page
        .getByText("상품이 등록되었습니다")
        .or(page.locator("text=상품 관리"))
    ).toBeVisible({ timeout: 15_000 })

    // 목록에서 등록된 상품 확인
    await page.goto("/admin/products")
    await expect(page.getByText(`${PREFIX} 테스트 니트`)).toBeVisible({
      timeout: 10_000,
    })
  })

  test("상품 검색", async ({ adminPage: page }) => {
    await page.goto("/admin/products")

    // 검색창에 입력
    const searchInput = page.getByPlaceholder("상품명 검색")
    await searchInput.fill(PREFIX)
    await page.getByRole("button", { name: "검색" }).click()

    // 결과 확인
    await expect(page.getByText(`${PREFIX} 테스트 니트`)).toBeVisible({
      timeout: 10_000,
    })
  })

  test("상품 수정", async ({ adminPage: page }) => {
    await page.goto("/admin/products")

    // 검색 후 수정 클릭
    const searchInput = page.getByPlaceholder("상품명 검색")
    await searchInput.fill(PREFIX)
    await page.getByRole("button", { name: "검색" }).click()

    await expect(page.getByText(`${PREFIX} 테스트 니트`)).toBeVisible({
      timeout: 10_000,
    })
    await page.getByRole("link", { name: "수정" }).first().click()

    // 수정 페이지 로드 확인
    await expect(page.getByText("기본 정보")).toBeVisible({ timeout: 10_000 })

    // 가격 변경
    const priceInput = page.getByLabel("정가 *")
    await priceInput.clear()
    await priceInput.fill("39000")

    // 저장
    await page.locator('button[type="submit"]').click()

    await expect(
      page
        .getByText("상품이 수정되었습니다")
        .or(page.locator("text=상품 관리"))
    ).toBeVisible({ timeout: 15_000 })
  })

  test("상품 삭제", async ({ adminPage: page }) => {
    await page.goto("/admin/products")

    const searchInput = page.getByPlaceholder("상품명 검색")
    await searchInput.fill(PREFIX)
    await page.getByRole("button", { name: "검색" }).click()

    await expect(page.getByText(`${PREFIX} 테스트 니트`)).toBeVisible({
      timeout: 10_000,
    })

    // confirm 다이얼로그 자동 수락
    page.on("dialog", (dialog) => dialog.accept())

    // 삭제 버튼 (Trash2 아이콘이 있는 ghost 버튼)
    const deleteButton = page
      .locator("button.text-destructive")
      .filter({ has: page.locator(".lucide-trash-2") })
      .first()
    await deleteButton.click()

    // 삭제 완료 토스트
    await expect(page.getByText("상품 삭제 완료")).toBeVisible({
      timeout: 10_000,
    })
  })
})
