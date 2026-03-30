"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { ORDER_STATUS_LABEL } from "@/constants"
import dayjs from "dayjs"

const STATUS_TABS = [
  { value: "ALL", label: "전체" },
  { value: "PAID", label: "결제완료" },
  { value: "PREPARING", label: "준비중" },
  { value: "SHIPPING", label: "배송중" },
  { value: "DELIVERED", label: "배송완료" },
  { value: "CANCELLED", label: "취소/교환/반품" },
]

const COURIERS = ["CJ대한통운", "롯데택배", "한진택배", "우체국택배", "로젠택배"]

interface OrderRow {
  id: string
  order_no: string
  status: string
  paid_amount: number
  created_at: string
  recipient: string
  recipient_phone: string
  order_items: { product_name: string; quantity: number }[]
}

const AdminOrdersPage = () => {
  const { toast } = useToast()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // 송장 입력 다이얼로그
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null)
  const [courier, setCourier] = useState(COURIERS[0])
  const [trackingNo, setTrackingNo] = useState("")

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from("orders")
      .select("*, order_items(product_name, quantity)")
      .order("created_at", { ascending: false })

    if (statusFilter === "CANCELLED") {
      query = query.in("status", [
        "CANCELLED",
        "RETURN_REQUESTED",
        "RETURNED",
        "EXCHANGE_REQUESTED",
        "EXCHANGED",
      ])
    } else if (statusFilter !== "ALL") {
      query = query.eq("status", statusFilter)
    }

    if (search) {
      query = query.or(
        `order_no.ilike.%${search}%,recipient.ilike.%${search}%,recipient_phone.ilike.%${search}%`
      )
    }

    const { data } = await query.limit(100)
    setOrders((data || []) as OrderRow[])
    setLoading(false)
  }, [statusFilter, search])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const supabase = createClient()
    await supabase.from("orders").update({ status: newStatus }).eq("id", orderId)
    fetchOrders()
    toast({ title: `주문 상태: ${ORDER_STATUS_LABEL[newStatus]}` })
  }

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.length === 0) return
    const supabase = createClient()
    await supabase.from("orders").update({ status: newStatus }).in("id", selectedIds)
    setSelectedIds([])
    fetchOrders()
    toast({ title: `${selectedIds.length}건 상태 변경: ${ORDER_STATUS_LABEL[newStatus]}` })
  }

  const handleTrackingSubmit = async () => {
    if (!trackingOrderId || !trackingNo) return
    const supabase = createClient()
    await supabase
      .from("orders")
      .update({ courier, tracking_no: trackingNo, status: "SHIPPING" })
      .eq("id", trackingOrderId)

    setTrackingOrderId(null)
    setTrackingNo("")
    fetchOrders()
    toast({ title: "송장번호 등록 완료" })
  }

  const handleCsvExport = () => {
    const header = "주문번호,주문자,연락처,상품,수량,금액,상태,주문일\n"
    const rows = orders
      .map((o) => {
        const itemName = o.order_items?.[0]?.product_name || ""
        const qty = o.order_items?.reduce((s, i) => s + i.quantity, 0) || 0
        return `${o.order_no},${o.recipient},${o.recipient_phone},"${itemName}",${qty},${o.paid_amount},${ORDER_STATUS_LABEL[o.status] || o.status},${dayjs(o.created_at).format("YYYY-MM-DD")}`
      })
      .join("\n")

    const bom = "\uFEFF"
    const blob = new Blob([bom + header + rows], {
      type: "text/csv;charset=utf-8;",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `orders_${dayjs().format("YYYYMMDD")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">주문 관리</h1>
        <Button variant="outline" onClick={handleCsvExport}>
          <Download className="h-4 w-4 mr-2" />
          CSV 다운로드
        </Button>
      </div>

      {/* 상태 탭 */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs md:text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* 검색 + 일괄 액션 */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="주문번호, 주문자명, 핸드폰번호 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {selectedIds.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleBulkStatusChange("PREPARING")}>
              준비중 ({selectedIds.length})
            </Button>
            <Button size="sm" onClick={() => handleBulkStatusChange("SHIPPING")}>
              배송중 ({selectedIds.length})
            </Button>
          </div>
        )}
      </div>

      {/* 테이블 */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.length === orders.length && orders.length > 0}
                  onChange={() =>
                    setSelectedIds(
                      selectedIds.length === orders.length
                        ? []
                        : orders.map((o) => o.id)
                    )
                  }
                  className="h-4 w-4 rounded"
                />
              </th>
              <th className="p-3 text-left">주문번호</th>
              <th className="p-3 text-left">주문자</th>
              <th className="p-3 text-left hidden md:table-cell">상품</th>
              <th className="p-3 text-right">금액</th>
              <th className="p-3 text-center">상태</th>
              <th className="p-3 text-left hidden md:table-cell">일자</th>
              <th className="p-3 text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-muted-foreground">
                  로딩 중...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-muted-foreground">
                  주문이 없습니다.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(order.id)}
                      onChange={() => toggleSelect(order.id)}
                      className="h-4 w-4 rounded"
                    />
                  </td>
                  <td className="p-3 font-mono text-xs">{order.order_no}</td>
                  <td className="p-3">
                    <p>{order.recipient}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.recipient_phone}
                    </p>
                  </td>
                  <td className="p-3 hidden md:table-cell max-w-[200px] truncate">
                    {order.order_items?.[0]?.product_name || "-"}
                    {(order.order_items?.length || 0) > 1 &&
                      ` 외 ${order.order_items.length - 1}건`}
                  </td>
                  <td className="p-3 text-right font-medium">
                    {order.paid_amount.toLocaleString()}원
                  </td>
                  <td className="p-3 text-center">
                    <Select
                      value={order.status}
                      onValueChange={(v) => handleStatusChange(order.id, v)}
                    >
                      <SelectTrigger className="h-7 text-xs w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell text-xs">
                    {dayjs(order.created_at).format("MM/DD HH:mm")}
                  </td>
                  <td className="p-3 text-center">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => setTrackingOrderId(order.id)}
                        >
                          송장
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>송장번호 입력</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <Select value={courier} onValueChange={setCourier}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COURIERS.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="송장번호 입력"
                            value={trackingNo}
                            onChange={(e) => setTrackingNo(e.target.value)}
                          />
                          <Button onClick={handleTrackingSubmit} className="w-full">
                            등록
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
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

export default AdminOrdersPage
