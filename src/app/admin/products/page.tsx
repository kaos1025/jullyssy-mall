import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "상품 관리 | 쥴리씨 어드민",
}

const statusLabel: Record<string, string> = {
  ACTIVE: "판매중",
  SOLDOUT: "품절",
  HIDDEN: "숨김",
  DELETED: "삭제",
}

interface AdminProductsPageProps {
  searchParams: { status?: string; search?: string }
}

const AdminProductsPage = async ({ searchParams }: AdminProductsPageProps) => {
  const admin = createAdminClient()

  let query = admin
    .from("products")
    .select("*, product_options(stock)")
    .neq("status", "DELETED")
    .order("created_at", { ascending: false })

  if (searchParams.status && searchParams.status !== "ALL") {
    query = query.eq("status", searchParams.status)
  }

  if (searchParams.search) {
    query = query.ilike("name", `%${searchParams.search}%`)
  }

  const { data } = await query

  const products = (data || []).map((p) => ({
    ...p,
    stock_sum:
      p.product_options?.reduce(
        (sum: number, o: { stock: number }) => sum + o.stock,
        0
      ) || 0,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">상품 관리</h1>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="h-4 w-4 mr-2" />
            상품 등록
          </Link>
        </Button>
      </div>

      {/* 필터 */}
      <form className="flex flex-col md:flex-row gap-3">
        <input
          name="search"
          defaultValue={searchParams.search || ""}
          placeholder="상품명 검색"
          className="flex-1 border rounded-md px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={searchParams.status || "ALL"}
          className="border rounded-md px-3 py-2 text-sm w-[140px]"
        >
          <option value="ALL">전체 상태</option>
          <option value="ACTIVE">판매중</option>
          <option value="SOLDOUT">품절</option>
          <option value="HIDDEN">숨김</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          검색
        </Button>
      </form>

      {/* 테이블 */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">상품명</th>
              <th className="p-3 text-right">가격</th>
              <th className="p-3 text-right hidden md:table-cell">재고</th>
              <th className="p-3 text-center">상태</th>
              <th className="p-3 text-left hidden md:table-cell">등록일</th>
              <th className="p-3 text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-10 text-muted-foreground"
                >
                  상품이 없습니다.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium max-w-[200px] truncate">
                    {product.name}
                  </td>
                  <td className="p-3 text-right">
                    {product.sale_price ? (
                      <span>
                        <span className="line-through text-muted-foreground mr-1">
                          {product.price.toLocaleString()}
                        </span>
                        {product.sale_price.toLocaleString()}
                      </span>
                    ) : (
                      product.price.toLocaleString()
                    )}
                    원
                  </td>
                  <td className="p-3 text-right hidden md:table-cell">
                    {product.stock_sum}
                  </td>
                  <td className="p-3 text-center">
                    <Badge
                      variant={
                        product.status === "ACTIVE"
                          ? "default"
                          : product.status === "SOLDOUT"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {statusLabel[product.status]}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">
                    {new Date(product.created_at).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="p-3 text-center">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/products/${product.id}`}>수정</Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminProductsPage
