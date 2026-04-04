import { create } from "zustand"
import type { CartItem } from "@/types"

interface CartState {
  items: CartItem[]
  isLoading: boolean

  fetchCart: () => Promise<void>
  addItem: (item: CartItem) => Promise<boolean>
  removeItem: (productOptionId: string) => Promise<void>
  updateQuantity: (productOptionId: string, quantity: number) => Promise<void>
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
}

export const useCart = create<CartState>()((set, get) => ({
  items: [],
  isLoading: false,

  fetchCart: async () => {
    set({ isLoading: true })
    try {
      const res = await fetch("/api/cart")
      if (!res.ok) {
        set({ items: [], isLoading: false })
        return
      }
      const items = await res.json()
      set({ items, isLoading: false })
    } catch {
      set({ items: [], isLoading: false })
    }
  },

  addItem: async (item) => {
    const prev = get().items

    // 낙관적 업데이트
    set((state) => {
      const existing = state.items.find(
        (i) => i.product_option_id === item.product_option_id
      )
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.product_option_id === item.product_option_id
              ? {
                  ...i,
                  quantity: Math.min(
                    i.quantity + item.quantity,
                    item.stock
                  ),
                }
              : i
          ),
        }
      }
      return { items: [...state.items, item] }
    })

    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_option_id: item.product_option_id,
          quantity: item.quantity,
        }),
      })
      if (!res.ok) {
        set({ items: prev })
        return false
      }
      return true
    } catch {
      set({ items: prev })
      return false
    }
  },

  removeItem: async (productOptionId) => {
    const prev = get().items

    set((state) => ({
      items: state.items.filter(
        (i) => i.product_option_id !== productOptionId
      ),
    }))

    try {
      const res = await fetch("/api/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_option_id: productOptionId }),
      })
      if (!res.ok) set({ items: prev })
    } catch {
      set({ items: prev })
    }
  },

  updateQuantity: async (productOptionId, quantity) => {
    const prev = get().items

    set((state) => ({
      items: state.items.map((i) =>
        i.product_option_id === productOptionId
          ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock)) }
          : i
      ),
    }))

    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_option_id: productOptionId,
          quantity,
        }),
      })
      if (!res.ok) set({ items: prev })
    } catch {
      set({ items: prev })
    }
  },

  clearCart: () => set({ items: [] }),

  getTotal: () => {
    const { items } = get()
    return items
      .filter((item) => !item.soldout)
      .reduce(
        (sum, item) => sum + (item.price + item.extra_price) * item.quantity,
        0
      )
  },

  getItemCount: () => {
    const { items } = get()
    return items.reduce((sum, item) => sum + item.quantity, 0)
  },
}))

// 기존 localStorage 데이터 정리
if (typeof window !== "undefined") {
  localStorage.removeItem("julie-cart")
}
