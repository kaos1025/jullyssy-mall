import Header from "@/components/layout/Header"
import Footer from "@/components/layout/Footer"
import MobileNav from "@/components/layout/MobileNav"
import TopBannerCarousel from "@/components/banners/TopBannerCarousel"
import { createClient } from "@/lib/supabase/server"
import { getActiveTopBanners } from "@/lib/banners"
import type { Category } from "@/types"

const ShopLayout = async ({
  children,
}: {
  children: React.ReactNode
}) => {
  const supabase = await createClient()

  const [{ data: allCategories }, banners] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    getActiveTopBanners(),
  ])

  // 1depth(부모) + 2depth(자식) 구조화
  const parentCategories = (allCategories ?? []).filter((c: Category) => !c.parent_id)
  const categoriesWithChildren = parentCategories.map((parent: Category) => ({
    ...parent,
    children: (allCategories ?? []).filter((c: Category) => c.parent_id === parent.id),
  }))

  return (
    <div className="min-h-screen flex flex-col">
      <TopBannerCarousel banners={banners} />
      <Header categories={categoriesWithChildren} />
      <main className="flex-1 pb-14 md:pb-0">{children}</main>
      <Footer />
      <MobileNav />
    </div>
  )
}

export default ShopLayout
