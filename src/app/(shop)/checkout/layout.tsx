import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "주문서 | 쥴리씨",
  robots: { index: false, follow: false },
}

const CheckoutLayout = ({ children }: { children: React.ReactNode }) => children

export default CheckoutLayout
