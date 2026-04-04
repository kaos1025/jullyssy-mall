"use client"

import { useEffect } from "react"
import { useCart } from "@/hooks/use-cart"

/** 주문 완료 후 장바구니 로컬 상태를 DB와 동기화 */
const CartSyncer = () => {
  const fetchCart = useCart((s) => s.fetchCart)

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  return null
}

export default CartSyncer
