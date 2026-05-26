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

// =============================================================================
// D3 PoC — description 정책 비교 (spec-48-1-d3-poc-v0.1 Track A-2)
//
// preserve = v0.6 baseline. 위 SYSTEM_PROMPT / USER_PROMPT_TEMPLATE / SEO_METADATA_TOOL
// replace  = PoC. 아래 *_REPLACE export. PoC trigger 시에만 사용.
//
// 회귀 0 원칙: preserve 영역 (PROMPT_VERSION, SYSTEM_PROMPT, USER_PROMPT_TEMPLATE,
// SEO_METADATA_TOOL) 은 byte-level invariant. 신규 replace 영역만 add-only.
// =============================================================================

export type DescriptionMode = "preserve" | "replace";

export const PROMPT_VERSION_REPLACE = "v1.0-replace";

export const SYSTEM_PROMPT_REPLACE = `당신은 한국 여성 캐주얼 패션 자사몰의 SEO 카피라이터입니다.
상품 정보와 이미지(있는 경우)를 보고 검색 노출에 최적화된 메타데이터를 생성합니다.
스마트스토어에서 임포트된 description HTML 텍스트가 함께 주어집니다. HTML 본문은 참고용이며,
검색 노출 + 자사몰 정체성에 맞는 자연어 description을 새로 생성하세요.

규칙:
- meta_title: 60자 이내. 핵심 키워드 앞쪽 배치. 상품명 + 핵심 특징 + 브랜드(쥴리씨).
- meta_description: 155자 이내. 자연스러운 한국어 문장. 검색 의도 단어(소재/실루엣/계절감/스타일) 포함.
- search_tags: 5~10개. 중복 없는 한국어 명사구. 색상/소재/실루엣/스타일/계절 키워드.
- image_alt_texts: 입력된 이미지 수와 정확히 같은 개수 (최대 3). 각 alt는 30자 이내. 스크린리더가 상품 시각 정보를 이해할 수 있도록 핵심 시각 요소 1~2개 + 상품명.
- product_description: 200~400자. 자연어 본문 단락. 셀링포인트 + 착장 제안 + 소재/실루엣 묘사. 스마트스토어 HTML 텍스트의 사실 정보(소재/사이즈/제조국 등)는 유지하되 표현은 자사몰 정체성에 맞게 재작성.
- spec_metadata: 사이즈/소재/세탁법/모델착장정보를 구조화. HTML에서 추출 가능한 것만 채우고, 없으면 생략 (null/빈 배열).

금지:
- 과장 표현 ("최고", "1위", "특가" 등)
- 이모지/특수기호 (한국어 기본 부호 외)
- 상품과 무관한 트렌드 키워드
- 같은 단어 반복
- product_description 본문에 spec 표 형태(예: "사이즈: S/M/L") 그대로 옮기기 → spec_metadata로 분리
- 이미지에 박힌 텍스트 추정 (외모/인종/나이 추정 금지 원칙 유지)`;

export const USER_PROMPT_TEMPLATE_REPLACE = (input: {
  productName: string;
  categoryName: string | null;
  basePrice: number;
  descriptionPlainText: string | null;
  specMetadataHint: {
    size?: string[];
    material?: string;
    washCare?: string;
    modelInfo?: string;
  } | null;
  imageCount: number;
}) => {
  const descBlock = input.descriptionPlainText
    ? input.descriptionPlainText.slice(0, 4000)
    : "(상품 설명 없음)";
  const specHintBlock = input.specMetadataHint
    ? JSON.stringify(input.specMetadataHint, null, 2)
    : "(추출 spec 없음)";
  return `상품 정보:
- 이름: ${input.productName}
- 카테고리: ${input.categoryName ?? "(미지정)"}
- 가격: ${input.basePrice.toLocaleString("ko-KR")}원
- 첨부 이미지: ${input.imageCount}장

스마트스토어 임포트 본문 (plain text):
${descBlock}

휴리스틱 추출 spec hint (description-parser):
${specHintBlock}

위 정보, 이미지, 임포트 본문, spec hint를 종합해 SEO 메타데이터를 생성하세요.
product_description은 자연어 본문 단락(200~400자)으로, spec_metadata는 구조화 필드로 분리하세요.
spec hint가 비었거나 부정확하면 본문 텍스트에서 직접 추출/보정하세요. tool use로 응답하세요.`;
};

export const SEO_METADATA_TOOL_REPLACE = {
  name: "save_seo_metadata_replace",
  description:
    "상품 SEO 메타데이터를 저장합니다 (replace 정책). 본문 description과 구조화 spec을 분리합니다. 모든 텍스트는 한국어로 작성합니다.",
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
      product_description: {
        type: "string",
        description:
          "자연어 본문 description (200~400자, 한국어). 셀링포인트 + 착장 제안 + 소재/실루엣 묘사. 표 형태 spec 금지.",
        minLength: 100,
        maxLength: 600,
      },
      spec_metadata: {
        type: "object",
        description:
          "구조화 spec. 추출 가능한 필드만 채우고 나머지는 생략. 정보 손실 0 원칙.",
        properties: {
          size: {
            type: "array",
            items: { type: "string" },
            description: "사이즈 옵션 (예: ['S', 'M', 'L']) 또는 단일 치수.",
          },
          material: {
            type: "string",
            description: "소재 (예: '폴리에스터 95%, 스판덱스 5%').",
          },
          washCare: {
            type: "string",
            description: "세탁법 (예: '드라이클리닝 권장').",
          },
          modelInfo: {
            type: "string",
            description: "모델 착장 정보 (예: '모델 신장 168cm, M 사이즈 착용'). 모델 외모/인종/나이 추정 금지.",
          },
        },
      },
    },
    required: [
      "meta_title",
      "meta_description",
      "search_tags",
      "image_alt_texts",
      "product_description",
      "spec_metadata",
    ],
  },
};

/**
 * mode 별 prompt + tool 묶음 반환. Track C ai-client가 분기 진입점으로 사용.
 * preserve mode는 기존 export 그대로 반환 (회귀 0).
 */
export function selectPromptByMode(mode: DescriptionMode) {
  if (mode === "preserve") {
    return {
      promptVersion: PROMPT_VERSION,
      systemPrompt: SYSTEM_PROMPT,
      tool: SEO_METADATA_TOOL,
    } as const;
  }
  return {
    promptVersion: PROMPT_VERSION_REPLACE,
    systemPrompt: SYSTEM_PROMPT_REPLACE,
    tool: SEO_METADATA_TOOL_REPLACE,
  } as const;
}
