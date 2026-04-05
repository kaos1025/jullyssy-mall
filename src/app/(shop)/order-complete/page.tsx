import { redirect } from "next/navigation"
import Link from "next/link"
import { CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/server"
import CartSyncer from "./CartSyncer"

interface OrderCompletePageProps {
  searchParams: { order_id?: string }
}

const OrderCompletePage = async ({ searchParams }: OrderCompletePageProps) => {
  if (!searchParams.order_id) redirect("/")

  const supabase = await createClient()
  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", searchParams.order_id)
    .single()

  if (!order) redirect("/")

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("product_name, color, size, quantity, price")
    .eq("order_id", searchParams.order_id)

  return (
    <div className="container max-w-lg py-12">
      <CartSyncer />
      <div className="text-center space-y-4">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
        <h1 className="text-2xl font-bold">주문이 완료되었습니다!</h1>
        <p className="text-muted-foreground">
          주문해주셔서 감사합니다.
        </p>
      </div>

      <div className="mt-8 border rounded-lg p-6 space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">주문번호</span>
          <span className="font-medium">{order.order_no}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">결제금액</span>
          <span className="font-bold text-lg">
            {order.paid_amount.toLocaleString()}원
          </span>
        </div>
        {orderItems && orderItems.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2 text-sm">
              <p className="font-medium">주문 상품</p>
              {orderItems.map((item, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <p className="flex-1 min-w-0">
                    <span className="line-clamp-1">{item.product_name}</span>
                    <span className="text-muted-foreground text-xs">
                      {item.color}/{item.size} · {item.quantity}개
                    </span>
                  </p>
                  <span className="flex-shrink-0">
                    {(item.price * item.quantity).toLocaleString()}원
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        <Separator />
        <div className="space-y-2 text-sm">
          <p className="font-medium">배송지 정보</p>
          <p>{order.recipient} / {order.recipient_phone}</p>
          <p className="text-muted-foreground">
            [{order.zipcode}] {order.address1} {order.address2 || ""}
          </p>
          {order.delivery_memo && (
            <p className="text-muted-foreground">
              메모: {order.delivery_memo}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <Button variant="outline" className="flex-1" asChild>
          <Link href="/mypage/orders">주문내역 보기</Link>
        </Button>
        <Button className="flex-1" asChild>
          <Link href="/products">쇼핑 계속하기</Link>
        </Button>
      </div>
    </div>
  )
}

export default OrderCompletePage
