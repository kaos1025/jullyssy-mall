"use client"

import { useEffect } from "react"
import { useCart } from "@/hooks/use-cart"

/** 주문 완료 후 장바구니 로컬 상태를 DB와 동기화 */
const CartSyncer = () => {
  const fetchCart = useCart((s) => s.fetchCart)

  useEffect(() => {
    fetchCart()
    // 부분선택 주문 식별자는 완료 후 정리 — 잔존 시 다음 직접 진입에서 stale 필터로 작용
    try {
      sessionStorage.removeItem("checkout_option_ids")
    } catch {}
  }, [fetchCart])

  return null
}

export default CartSyncer
