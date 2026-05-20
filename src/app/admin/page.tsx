import { notFound } from "next/navigation"
import { verifyAdmin } from "@/lib/api-helpers/verifyAdmin"
import { createAdminClient } from "@/lib/supabase/admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ORDER_STATUS_LABEL } from "@/constants"
import { getSeoDashboardStats } from "@/lib/seo/dashboard"
import SeoBackfillTrigger from "./_components/seo-backfill-trigger"
import dayjs from "dayjs"

export const dynamic = "force-dynamic"

const AdminDashboardPage = async () => {
  const user = await verifyAdmin()
  if (!user) notFound()

  const admin = createAdminClient()
  const today = dayjs().startOf("day").toISOString()

  // 병렬 조회
  const [ordersToday, salesToday, pendingOrders, newMembers, recentOrders, lowStock, seoStats] =
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
      // SEO 운영 통계
      getSeoDashboardStats(),
    ])

  const seoUsagePct = seoStats.cap_set
    ? Math.min(100, Math.round(seoStats.usage_ratio * 100))
    : 0
  const seoAlertLevel: "ok" | "warn" | "danger" = !seoStats.cap_set
    ? "ok"
    : seoStats.usage_ratio >= 1
      ? "danger"
      : seoStats.usage_ratio >= 0.75
        ? "warn"
        : "ok"

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

      {/* SEO 운영 카드 */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">SEO 자동화 (#48-1)</CardTitle>
          <Badge
            variant={
              seoAlertLevel === "danger"
                ? "destructive"
                : seoAlertLevel === "warn"
                  ? "default"
                  : "outline"
            }
          >
            {!seoStats.cap_set
              ? "CAP 미설정"
              : `${seoUsagePct}% (${seoStats.month_cost_usd.toFixed(4)} / ${seoStats.cap_usd.toFixed(2)} USD)`}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {seoStats.cap_set && (
            <div className="h-2 w-full bg-muted rounded overflow-hidden">
              <div
                className={
                  seoAlertLevel === "danger"
                    ? "h-full bg-destructive"
                    : seoAlertLevel === "warn"
                      ? "h-full bg-amber-500"
                      : "h-full bg-primary"
                }
                style={{ width: `${seoUsagePct}%` }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">pending_review</p>
              <p className="font-semibold">{seoStats.draft_counts.pending_review}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">approved</p>
              <p className="font-semibold">{seoStats.draft_counts.approved}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">rejected</p>
              <p className="font-semibold">{seoStats.draft_counts.rejected}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">failed</p>
              <p className="font-semibold">{seoStats.draft_counts.failed}</p>
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-xs font-medium mb-2">Backfill 실행</p>
            <SeoBackfillTrigger />
          </div>
        </CardContent>
      </Card>

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
