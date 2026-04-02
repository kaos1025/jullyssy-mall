import Header from "@/components/layout/Header"
import Footer from "@/components/layout/Footer"
import MobileNav from "@/components/layout/MobileNav"
import { createClient } from "@/lib/supabase/server"
import type { Category } from "@/types"

const ShopLayout = async ({
  children,
}: {
  children: React.ReactNode
}) => {
  const supabase = await createClient()

  const { data: allCategories } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order")

  // 1depth(부모) + 2depth(자식) 구조화
  const parentCategories = (allCategories ?? []).filter((c: Category) => !c.parent_id)
  const categoriesWithChildren = parentCategories.map((parent: Category) => ({
    ...parent,
    children: (allCategories ?? []).filter((c: Category) => c.parent_id === parent.id),
  }))

  return (
    <div className="min-h-screen flex flex-col">
      <Header categories={categoriesWithChildren} />
      <main className="flex-1 pb-14 md:pb-0">{children}</main>
      <Footer />
      <MobileNav />
    </div>
  )
}

export default ShopLayout
