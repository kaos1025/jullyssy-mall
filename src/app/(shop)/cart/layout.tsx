import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "장바구니 | 쥴리씨",
  robots: { index: false, follow: false },
}

const CartLayout = ({ children }: { children: React.ReactNode }) => children

export default CartLayout
