# 외부 서비스와 AI

2026-11-24 확인 · [수집 기준](../raw/index.md#2026-11-24--작업과-검증-이력-보완) · [위키 색인](../index.md)

| 영역 | 확인한 구현과 범위 |
| --- | --- |
| 이메일·소셜 로그인 | Google·Naver·Kakao는 설정된 제공자만 활성화됩니다. [가입·계정 찾기·소셜 로그인](application.md#인증과-토큰-재발급) · [이메일 인증 서비스](../../backend/src/main/java/com/zip/backend/auth/emailcheck/EmailAuthService.java)(메일 계정 발송 한도를 넘지 않게 서버 전체·IP별 상한, [발송 제한](application.md#인증과-토큰-재발급)) · [소셜 설정 코드](../../backend/src/main/java/com/zip/backend/auth/SocialOAuthConfiguration.java) |
| Gemini·고지서 | 서버가 사진 인식 결과를 임시 저장하고, 회원이 확인한 뒤 고정 지출에 등록합니다. 확정할 때 일반 월별 고정 지출 등록과 같은 입력 검증을 거칩니다. 임시 결과에는 만료 시간이 있으며 사진·문서 식별자로 중복 등록을 막습니다. [월별 고정 지출 DTO](fixed-expenses.md#일반-고정-지출의-납부와-해지) · [고지서 API](../../backend/src/main/java/com/zip/backend/bills/BillPhotoController.java) · [고지서 등록 테스트](../../backend/src/test/java/com/zip/backend/BillMonthlyWriteTests.java) |
| AI 사용량 안내 | AI 한도에 도달하면 화면에서 기능 사용법·문의 안내·질문 재전송을 사용할 수 있습니다. PR #136 시점에 임시 계정으로 WebKit PC·모바일 화면과 재전송을 확인했습니다. [AI 대화 화면](../../frontend/src/features/ai/components/AiChat.tsx) · [변경 기록](../../CHANGELOG.md#프론트엔드) |
| 지도·날씨·GPS | [카카오 장소 식별자](map-place-ids.md) · [홈 날씨 위치](#홈-날씨-위치) |
| 약관·소개 화면 | 개인정보 처리방침에 Gemini API의 처리 주체와 국가를 명시하고, 소개 화면에 서버 저장과 외부 서비스 출처를 안내합니다. 저장소 정책 문서는 출시 전 클라우드 업체와 데이터 보관 국가 확정을 남은 작업으로 표시합니다. [개인정보 처리방침](../../frontend/src/features/legal/content.ts) · [소개 화면 문구](../../frontend/src/features/brand/content.ts) · [약관 마이그레이션](../../db/migrations/20261122_06_terms_privacy_ai.sql) |

도움말·가계부 요약·근처 탐색은 앱의 전용 경로를 사용합니다. 수입 대비 지출 요약은 가계부 집계로 만들고, 근처 탐색은 지도 API를 사용합니다. 앱이 만든 응답은 대화에 기록할 수 있으며 Gemini 질문 횟수를 차감하지 않습니다. 일반 상담의 서버 요청은 Gemini를 사용하며 제공자 한도와 회원의 일일 질문 한도를 따로 처리합니다. [PR #124](https://github.com/teammzip/project-ZIP/pull/124) · [AI 화면 분기](../../frontend/src/features/ai/components/AiChat.tsx) · [대화 저장과 한도](../../backend/src/main/java/com/zip/backend/ai/AiService.java)

서버 모드에서 일반 상담이 서버에 닿지 못하면 화면은 데모 답변으로 바꾸지 않고 연결 실패 안내를 보여 줍니다. 응답이 없거나, 처리하지 않은 오류이거나, 답이 비었거나, 대화방을 만들지 못한 경우가 여기에 해당합니다. 데모 답변은 모의 API 모드에서만 사용합니다. 홈 모달과 AI 화면이 같은 규칙을 따릅니다(2026-11-27). [AI 요청 처리](../../frontend/src/features/ai/api.ts) · [홈 AI 모달](../../frontend/src/features/ai/components/ChatModal.tsx) · [연결 실패 테스트](../../frontend/tests/ai-quota.test.mjs)

서버 모드의 약관 화면은 공개 `GET /api/terms`에서 현재 문서를 읽습니다. 아직 응답을 받지 못했거나 서버 이용이 어려우면 화면에 포함된 문구를 표시합니다. [약관 조회](../../frontend/src/features/legal/api.ts) · [약관 API](../../backend/src/main/java/com/zip/backend/legal/TermsController.java)

## 홈 날씨 위치

홈 날씨는 주거 설문 주소를 우선하고, 주소를 해석할 때 지번 등 세부 주소를 줄여 다시 찾습니다. [날씨 위치 선택](../../frontend/src/features/weather/useWeatherLocation.ts) · [주소 후보](../../frontend/src/features/weather/addressRegion.ts)

설문 주소가 없으면 날씨와 홈·동네 지도는 같은 우리 동네를 씁니다. 순서는 이 브라우저에서 직접 인증·변경한 동네 → 서버(DB)에 남은 동네 인증(다른 기기에서 인증한 경우, 서버 회원 응답의 `region.fullName`을 `서울 중구`처럼 줄여 사용) → 설문 주소 → 가입 주소 → 서버의 회원 동네입니다. 서버 인증은 이 브라우저의 설문 선택보다 앞섭니다. 서버에는 인증 좌표가 없어서 다른 기기에서 인증한 동네는 이름으로 위치를 찾습니다(2026-11-26). [동네 선택](../../frontend/src/features/life/neighborhood.ts) · [기준 위치](../../frontend/src/features/life/useNeighborhoodLocation.ts) · [선택 순서 테스트](../../frontend/tests/neighborhood-location.test.mjs)

## 검증 범위

2026-11-20 로컬 점검은 합성 계정과 모의 응답으로 이메일·OAuth 오류, 고지서 동의·중복·시간 초과, 위치 권한 실패와 Kakao 쿼터 처리를 확인했습니다. [팀원 검증의 출처와 확인 범위](../raw/index.md#2026-11-24--작업과-검증-이력-보완) · [최신 배포에서 확인할 경로](project-status.md#검증해야-될-부분)
