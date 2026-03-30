import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { CartItem } from "@/types"

interface CartState {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (productOptionId: string) => void
  updateQuantity: (productOptionId: string, quantity: number) => void
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
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
        }),

      removeItem: (productOptionId) =>
        set((state) => ({
          items: state.items.filter(
            (i) => i.product_option_id !== productOptionId
          ),
        })),

      updateQuantity: (productOptionId, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.product_option_id === productOptionId
              ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock)) }
              : i
          ),
        })),

      clearCart: () => set({ items: [] }),

      getTotal: () => {
        const { items } = get()
        return items.reduce(
          (sum, item) => sum + (item.price + item.extra_price) * item.quantity,
          0
        )
      },

      getItemCount: () => {
        const { items } = get()
        return items.reduce((sum, item) => sum + item.quantity, 0)
      },
    }),
    {
      name: "julie-cart",
    }
  )
)
