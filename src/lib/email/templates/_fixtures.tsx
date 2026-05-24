import { createElement, type ReactElement } from "react"

import { OrderConfirmation, type OrderConfirmationProps } from "./OrderConfirmation"

// Dev preview / send-test 라우트와 unit test에서 공유되는 sample props.
// production bundle에서는 dev 라우트가 VERCEL_ENV === "production" 시 404 처리되므로 도달 불가.

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
    recipient: "홍길동",
    phone: "010-1234-5678",
    postalCode: "04567",
    address: "서울특별시 중구 장충단로13길 20",
    addressDetail: "현대시티타워 12층",
    message: "부재시 경비실에 맡겨주세요",
  },
  orderDetailUrl: "https://jullyssy.shop/mypage/orders/abc123",
}

export const renderOrderConfirmationSample = (): ReactElement =>
  createElement(OrderConfirmation, orderConfirmationSample)
