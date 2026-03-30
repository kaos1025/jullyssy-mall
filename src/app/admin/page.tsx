import { createAdminClient } from "@/lib/supabase/admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ORDER_STATUS_LABEL } from "@/constants"
import dayjs from "dayjs"

const AdminDashboardPage = async () => {
  const admin = createAdminClient()
  const today = dayjs().startOf("day").toISOString()

  // 병렬 조회
  const [ordersToday, salesToday, pendingOrders, newMembers, recentOrders, lowStock] =
    await Promise.all([
      // 오늘 주문수
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", today)
        .neq("status", "CANCELLED"),
      // 오늘 매출
      admin
        .from("orders")
        .select("paid_amount")
        .gte("created_at", today)
        .neq("status", "CANCELLED"),
      // 미처리 주문 (PAID)
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "PAID"),
      // 오늘 신규회원
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", today),
      // 최근 주문 10건
      admin
        .from("orders")
        .select("*, order_items(product_name)")
        .order("created_at", { ascending: false })
        .limit(10),
      // 재고 부족 상품 (10개 이하)
      admin
        .from("product_options")
        .select("*, product:products(name)")
        .lte("stock", 10)
        .order("stock", { ascending: true })
        .limit(10),
    ])

  const todaySales =
    salesToday.data?.reduce(
      (sum: number, o: { paid_amount: number }) => sum + o.paid_amount,
      0
    ) || 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>

      {/* 카드 4개 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              오늘 주문
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{ordersToday.count || 0}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              오늘 매출
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {todaySales.toLocaleString()}원
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              미처리 주문
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {pendingOrders.count || 0}건
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              오늘 신규회원
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{newMembers.count || 0}명</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 최근 주문 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 주문</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentOrders.data?.map(
                (order: {
                  id: string
                  order_no: string
                  status: string
                  paid_amount: number
                  created_at: string
                  order_items: { product_name: string }[]
                }) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {order.order_items?.[0]?.product_name || "상품"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.order_no} ·{" "}
                        {dayjs(order.created_at).format("MM/DD HH:mm")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <span className="font-medium">
                        {order.paid_amount.toLocaleString()}원
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {ORDER_STATUS_LABEL[order.status] || order.status}
                      </Badge>
                    </div>
                  </div>
                )
              )}
              {(!recentOrders.data || recentOrders.data.length === 0) && (
                <p className="text-center py-4 text-muted-foreground text-sm">
                  주문이 없습니다.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 재고 부족 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">재고 부족 상품</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStock.data?.map(
                (opt: {
                  id: string
                  color: string
                  size: string
                  stock: number
                  product: { name: string } | null
                }) => (
                  <div
                    key={opt.id}
                    className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                  >
                    <div>
                      <p className="font-medium">
                        {opt.product?.name || "상품"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {opt.color} / {opt.size}
                      </p>
                    </div>
                    <Badge
                      variant={opt.stock === 0 ? "destructive" : "secondary"}
                    >
                      {opt.stock}개
                    </Badge>
                  </div>
                )
              )}
              {(!lowStock.data || lowStock.data.length === 0) && (
                <p className="text-center py-4 text-muted-foreground text-sm">
                  재고 부족 상품이 없습니다.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default AdminDashboardPage
