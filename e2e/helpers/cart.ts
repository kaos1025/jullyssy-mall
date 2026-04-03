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
 * addInitScript로 장바구니를 주입합니다.
 * 페이지 로드 전에 localStorage에 기록되므로 Zustand hydration 시 반영됩니다.
 * 주의: goto() 전에 호출해야 합니다.
 */
export const injectCartBeforeLoad = async (page: Page, items: CartItem[]) => {
  const cartJson = JSON.stringify({ state: { items }, version: 0 })
  await page.addInitScript((json: string) => {
    localStorage.setItem("julie-cart", json)
  }, cartJson)
}

/**
 * localStorage 장바구니를 비웁니다.
 */
export const clearCart = async (page: Page) => {
  await page.evaluate(() => {
    localStorage.removeItem("julie-cart")
  })
}
