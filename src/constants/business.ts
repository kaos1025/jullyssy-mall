export const BUSINESS_INFO = {
  companyName: "쥴리씨",
  representative: "이진주",
  businessNumber: "291-25-00254",
  businessNumberDigits: "2912500254",
  mailOrderNumber: "제 2025-서울중구-659호",
  address: "서울특별시 중구 장충단로13길 20, 현대시티타워 12층 B-10/1,3호",
  addressDetail: "(을지로6가)",
  domain: "jullyssy.shop",
  siteUrl: "https://jullyssy.shop",
  customerCenter: {
    phone: "010-2998-1230",
    phoneDisplay: "010-2998-1230",
    phoneTel: "+82-10-2998-1230",
    email: "jullyssy@naver.com",
    hours: "평일 10:00 - 17:00",
    lunch: "점심 12:00 - 13:00",
    holiday: "주말·공휴일 휴무",
  },
  privacyOfficer: {
    name: "이진주",
    email: "jullyssy@naver.com",
    phone: "010-2998-1230",
  },
} as const

export const BUSINESS_POSTAL_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: "장충단로13길 20, 현대시티타워 12층 B-10/1,3호",
  addressLocality: "중구",
  addressRegion: "서울특별시",
  postalCode: "04567",
  addressCountry: "KR",
} as const
