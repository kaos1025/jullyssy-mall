// SEO 생성 프롬프트 — spec §3 v1.0.
// prompt_version은 draft 저장 시 함께 기록 (재현성 + 버전별 품질 비교).

export const PROMPT_VERSION = "v1.0";

export const SYSTEM_PROMPT = `당신은 한국 여성 캐주얼 패션 자사몰의 SEO 카피라이터입니다.
상품 정보와 이미지(있는 경우)를 보고 검색 노출에 최적화된 메타데이터를 생성합니다.

규칙:
- meta_title: 60자 이내. 핵심 키워드 앞쪽 배치. 상품명 + 핵심 특징 + 브랜드(쥴리씨).
- meta_description: 155자 이내. 자연스러운 한국어 문장. 검색 의도 단어(소재/실루엣/계절감/스타일) 포함.
- search_tags: 5~10개. 중복 없는 한국어 명사구. 색상/소재/실루엣/스타일/계절 키워드.
- image_alt_texts: 입력된 이미지 수와 정확히 같은 개수 (최대 3). 각 alt는 30자 이내. 스크린리더가 상품 시각 정보를 이해할 수 있도록 핵심 시각 요소 1~2개 + 상품명.

금지:
- 과장 표현 ("최고", "1위", "특가" 등)
- 이모지/특수기호 (한국어 기본 부호 외)
- 상품과 무관한 트렌드 키워드
- 같은 단어 반복`;

export const USER_PROMPT_TEMPLATE = (input: {
  productName: string;
  categoryName: string | null;
  basePrice: number;
  description: string | null;
  imageCount: number;
}) => {
  const descSnippet = input.description
    ? input.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800)
    : "(상품 설명 없음)";
  return `상품 정보:
- 이름: ${input.productName}
- 카테고리: ${input.categoryName ?? "(미지정)"}
- 가격: ${input.basePrice.toLocaleString("ko-KR")}원
- 설명 발췌: ${descSnippet}
- 첨부 이미지: ${input.imageCount}장

위 정보와 이미지를 바탕으로 SEO 메타데이터를 생성하세요. tool use로 응답하세요.`;
};

export const SEO_METADATA_TOOL = {
  name: "save_seo_metadata",
  description:
    "상품 SEO 메타데이터를 저장합니다. 모든 필드는 한국어로 작성합니다.",
  input_schema: {
    type: "object" as const,
    properties: {
      meta_title: {
        type: "string",
        description: "검색 결과 제목 (60자 이내, 한국어).",
        maxLength: 60,
      },
      meta_description: {
        type: "string",
        description: "검색 결과 설명 (155자 이내, 한국어).",
        maxLength: 155,
      },
      search_tags: {
        type: "array",
        items: { type: "string" },
        description: "검색 키워드 5~10개 (한국어 명사구).",
        minItems: 5,
        maxItems: 10,
      },
      image_alt_texts: {
        type: "array",
        description: "각 이미지의 alt 텍스트. 입력 이미지 수와 정확히 같은 개수 (최대 3개).",
        items: {
          type: "object",
          properties: {
            image_index: {
              type: "integer",
              description: "0-based image index (sort_order asc 순서).",
              minimum: 0,
            },
            alt_text: {
              type: "string",
              description: "alt 텍스트 (30자 이내, 한국어).",
              maxLength: 30,
            },
          },
          required: ["image_index", "alt_text"],
        },
        maxItems: 3,
      },
    },
    required: ["meta_title", "meta_description", "search_tags", "image_alt_texts"],
  },
};
