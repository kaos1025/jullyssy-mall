import { addCartItem, cleanupCartItems } from "./supabase-admin"

/**
 * DB를 통해 장바구니에 상품을 추가합니다.
 * cart_items 테이블에 직접 insert하므로 로그인 유저만 가능합니다.
 * 주의: 테스트 시작 전 또는 goto() 전에 호출하세요. 페이지 로드 시 useCart().fetchCart()가 DB에서 읽습니다.
 */
export const injectCartViaDB = async (
  userId: string,
  items: Array<{ productOptionId: string; quantity: number }>
) => {
  for (const item of items) {
    await addCartItem(userId, item.productOptionId, item.quantity)
  }
}

/**
 * DB 장바구니를 비웁니다.
 */
export const clearCartDB = async (userId: string) => {
  await cleanupCartItems(userId)
}
