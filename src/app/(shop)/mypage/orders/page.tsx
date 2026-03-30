import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { ORDER_STATUS_LABEL } from "@/constants"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "주문내역 | 쥴리씨",
}

interface OrdersPageProps {
  searchParams: { page?: string }
}

const statusVariant = (status: string) => {
  switch (status) {
    case "PAID":
    case "PREPARING":
      return "default" as const
    case "SHIPPING":
      return "secondary" as const
    case "DELIVERED":
    case "CONFIRMED":
      return "outline" as const
    case "CANCELLED":
    case "RETURNED":
      return "destructive" as const
    default:
      return "secondary" as const
  }
}

const OrdersPage = async ({ searchParams }: OrdersPageProps) => {
  const supabase = createClient()
  const page = Number(searchParams.page) || 1
  const pageSize = 10
  const offset = (page - 1) * pageSize

  const { data: orders, count } = await supabase
    .from("orders")
    .select("*, order_items(*)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1)

  const totalPages = Math.ceil((count || 0) / pageSize)

  if (!orders || orders.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        주문내역이 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">주문내역</h2>

      {orders.map((order) => {
        const firstItem = order.order_items?.[0]
        const itemCount = order.order_items?.length || 0

        return (
          <Link
            key={order.id}
            href={`/mypage/orders/${order.id}`}
            className="block border rounded-lg p-4 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{order.order_no}</span>
                <Badge variant={statusVariant(order.status)}>
                  {ORDER_STATUS_LABEL[order.status] || order.status}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(order.created_at).toLocaleDateString("ko-KR")}
              </span>
            </div>

            <div className="flex gap-3">
              {firstItem?.product_image && (
                <div className="relative h-16 w-14 flex-shrink-0 overflow-hidden rounded bg-muted">
                  <Image
                    src={firstItem.product_image}
                    alt={firstItem.product_name}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm line-clamp-1">
                  {firstItem?.product_name || "상품"}
                  {itemCount > 1 && ` 외 ${itemCount - 1}건`}
                </p>
                <p className="text-sm font-bold mt-1">
                  {order.paid_amount.toLocaleString()}원
                </p>
              </div>
            </div>
          </Link>
        )
      })}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/mypage/orders?page=${p}`}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-sm ${
                p === page
                  ? "bg-primary text-primary-foreground"
                  : "border hover:bg-muted"
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export default OrdersPage
