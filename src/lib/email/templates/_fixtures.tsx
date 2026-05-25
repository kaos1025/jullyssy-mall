import { createElement, type ReactElement } from "react"

import {
  OrderConfirmation,
  type OrderConfirmationProps,
} from "./OrderConfirmation"
import {
  RefundCompleted,
  type RefundCompletedProps,
} from "./RefundCompleted"
import {
  ShippingDelivered,
  type ShippingDeliveredProps,
} from "./ShippingDelivered"
import {
  ShippingStarted,
  type ShippingStartedProps,
} from "./ShippingStarted"

// Dev preview / send-test 라우트와 unit test에서 공유되는 sample props.
// production bundle에서는 dev 라우트가 VERCEL_ENV === "production" 시 404 처리되므로 도달 불가.

const sampleShipping = {
  recipient: "홍길동",
  phone: "010-1234-5678",
  postalCode: "04567",
  address: "서울특별시 중구 장충단로13길 20",
  addressDetail: "현대시티타워 12층",
}

export const orderConfirmationSample: OrderConfirmationProps = {
  customerName: "홍길동",
  orderNo: "20260524-000123",
  orderDate: "2026-05-24 14:30",
  items: [
    {
      productName: "오버사이즈 셔츠 자켓",
      optionName: "BLACK / M",
      quantity: 1,
      priceEach: 38000,
    },
    {
      productName: "데일리 크롭 니트",
      optionName: "IVORY / FREE",
      quantity: 2,
      priceEach: 19000,
    },
  ],
  subtotal: 76000,
  shippingFee: 0,
  discount: 3000,
  total: 73000,
  paymentMethod: "카카오페이",
  shipping: {
    ...sampleShipping,
    message: "부재시 경비실에 맡겨주세요",
  },
  orderDetailUrl: "https://jullyssy.shop/mypage/orders/abc123",
}

export const shippingStartedSample: ShippingStartedProps = {
  customerName: "홍길동",
  orderNo: "20260524-000123",
  shippedDate: "2026-05-26 10:30",
  courierName: "CJ대한통운",
  trackingNumber: "1234567890123",
  trackingUrl:
    "https://trace.cjlogistics.com/web/detail.jsp?slipno=1234567890123",
  shipping: sampleShipping,
  orderDetailUrl: "https://jullyssy.shop/mypage/orders/abc123",
}

export const shippingDeliveredSample: ShippingDeliveredProps = {
  customerName: "홍길동",
  orderNo: "20260524-000123",
  deliveredDate: "2026-05-28 14:20",
  items: [
    {
      productName: "오버사이즈 셔츠 자켓",
      optionName: "BLACK / M",
      quantity: 1,
    },
    {
      productName: "데일리 크롭 니트",
      optionName: "IVORY / FREE",
      quantity: 2,
    },
  ],
  orderDetailUrl: "https://jullyssy.shop/mypage/orders/abc123",
}

export const refundCompletedSample: RefundCompletedProps = {
  customerName: "홍길동",
  orderNo: "20260524-000123",
  refundedDate: "2026-05-30 11:00",
  refundAmount: 73000,
  paymentMethod: "카카오페이",
  refundEta: "즉시~1 영업일",
  items: [
    {
      productName: "오버사이즈 셔츠 자켓",
      optionName: "BLACK / M",
      quantity: 1,
    },
    {
      productName: "데일리 크롭 니트",
      optionName: "IVORY / FREE",
      quantity: 2,
    },
  ],
  orderDetailUrl: "https://jullyssy.shop/mypage/orders/abc123",
}

export const renderOrderConfirmationSample = (): ReactElement =>
  createElement(OrderConfirmation, orderConfirmationSample)

export const renderShippingStartedSample = (): ReactElement =>
  createElement(ShippingStarted, shippingStartedSample)

export const renderShippingDeliveredSample = (): ReactElement =>
  createElement(ShippingDelivered, shippingDeliveredSample)

export const renderRefundCompletedSample = (): ReactElement =>
  createElement(RefundCompleted, refundCompletedSample)

export const SAMPLE_SUBJECTS = {
  "order-confirmation": "[쥴리씨] 주문 확정 안내 (dev test)",
  "shipping-started": "[쥴리씨] 상품 출고 안내 (dev test)",
  "shipping-delivered": "[쥴리씨] 배송 완료 안내 (dev test)",
  "refund-completed": "[쥴리씨] 환불 완료 안내 (dev test)",
} as const

export type TemplateKey = keyof typeof SAMPLE_SUBJECTS

export const renderByKey = (key: TemplateKey): ReactElement => {
  switch (key) {
    case "order-confirmation":
      return renderOrderConfirmationSample()
    case "shipping-started":
      return renderShippingStartedSample()
    case "shipping-delivered":
      return renderShippingDeliveredSample()
    case "refund-completed":
      return renderRefundCompletedSample()
  }
}

export const isTemplateKey = (s: string): s is TemplateKey =>
  s in SAMPLE_SUBJECTS
