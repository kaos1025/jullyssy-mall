import Header from "@/components/layout/Header"
import Footer from "@/components/layout/Footer"
import MobileNav from "@/components/layout/MobileNav"

const ShopLayout = ({
  children,
}: {
  children: React.ReactNode
}) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pb-14 md:pb-0">{children}</main>
      <Footer />
      <MobileNav />
    </div>
  )
}

export default ShopLayout
