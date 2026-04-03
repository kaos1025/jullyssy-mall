import type { Page } from "@playwright/test"

interface CartItem {
  product_id: string
  product_option_id: string
  product_name: string
  product_image: string | null
  color: string
  size: string
  price: number
  extra_price: number
  quantity: number
  stock: number
}

/**
 * localStorage에 장바구니 데이터를 직접 주입합니다.
 * Zustand persist 형식: { state: { items: [...] }, version: 0 }
 *
 * 사용법: 페이지 이동 전에 호출 (about:blank 상태 등)
 * 또는 이미 로드된 페이지에서 호출 후 reload
 */
export const injectCart = async (page: Page, items: CartItem[]) => {
  // localStorage 접근을 위해 최소한의 페이지가 로드되어야 함
  if (page.url() === "about:blank") {
    await page.goto("/", { waitUntil: "commit" })
  }
  await page.evaluate((cartItems) => {
    const cartState = {
      state: { items: cartItems },
      version: 0,
    }
    localStorage.setItem("julie-cart", JSON.stringify(cartState))
  }, items)
}

/**
 * localStorage 장바구니를 비웁니다.
 */
export const clearCart = async (page: Page) => {
  await page.evaluate(() => {
    localStorage.removeItem("julie-cart")
  })
}
