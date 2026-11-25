# 지도 장소 식별자

2026-11-24 코드 확인 · [변경 기록 수집](../raw/index.md#2026-11-24--변경-기록-수집) · [위키 색인](../index.md)

ZIP은 앱에서 카카오 장소를 `kakao:<장소ID>`로 식별합니다. 접두사 뒤에는 ASCII 숫자가 1~50자리 와야 하며, 원본 ID는 문자열로 보존합니다. ZIP DB의 장소 ID는 숫자 문자열로 표현합니다. 프론트와 백엔드는 같은 형식을 사용해 지도·즐겨찾기·리뷰에서 카카오 장소를 판별합니다. [지도 API 계약](../../frontend/API.md#9-지도-) · [프론트 장소 키](../../frontend/src/features/map/kakaoPlaceId.ts) · [백엔드 장소 키](../../backend/src/main/java/com/zip/backend/map/KakaoPlaceId.java)

지도 검색 결과와 저장 목록에는 접두사가 붙은 앱용 키가 들어갑니다. 카카오 즐겨찾기와 리뷰 테이블에서는 접두사를 벗긴 원본 ID를 사용합니다. 이 경계에서 원본 ID를 숫자로 변환하면 선행 0이나 긴 ID가 달라질 수 있으므로 문자열 그대로 전달합니다. [지도 서비스](../../backend/src/main/java/com/zip/backend/map/MapService.java) · [리뷰 저장](../../backend/src/main/java/com/zip/backend/map/PlaceReviewRepository.java) · [앱 구조](application.md)

`GET /api/places/reviews/mine`은 로그인한 회원의 ZIP DB 장소 리뷰와 카카오 장소 리뷰를 최신순으로 함께 반환합니다. 리뷰에는 사진을 최대 5장 첨부할 수 있으며, 첨부 해제·리뷰 삭제 후 불필요해진 사진은 정리합니다. 작성 도중 올리고 연결하지 않은 파일도 일정 시간이 지나면 정리 대상이 됩니다. [리뷰 API 계약](../../frontend/API.md#9-지도-) · [리뷰 컨트롤러](../../backend/src/main/java/com/zip/backend/map/PlaceReviewController.java) · [리뷰 처리](../../backend/src/main/java/com/zip/backend/map/PlaceReviewService.java) · [파일 정리](../../backend/src/main/java/com/zip/backend/files/ProfileFileService.java)

[주변 동네 탭과 글 필터](community-operations.md#동네-글과-조회-집계) · [전국 이웃 데이터](database.md#전국-데이터)

## 장소 검색과 저장 리스트

장소 검색은 지도 중심이나 저장된 집 좌표를 사용하며 종류·검색어·조건을 적용합니다. 카카오 검색이 사용할 수 없는 경우 일반 지도 목록은 ZIP DB의 장소로 대체합니다. 사용량 제한·오류는 `X-Place-Notice`로 전달하며, 카카오 검색 응답 자체는 이력으로 영구 저장하지 않습니다. 즐겨찾기에는 필요한 장소 ID·이름·분류를 저장합니다. [지도 서비스](../../backend/src/main/java/com/zip/backend/map/MapService.java) · [카카오 사용량 처리](../../backend/src/main/java/com/zip/backend/map/KakaoQuota.java)

2026-11-25 확인. 지도 화면에서 실행한 검색은 검색을 시작한 동네 위치에 연결됩니다. 위치가 바뀌면 이전 결과와 대기 표시를 지우고 진행 중인 요청을 취소합니다. [지도 화면](../../frontend/src/features/map/components/MapView.tsx)

장소를 여러 저장 리스트에 넣을 수 있습니다. 해당 장소를 유일하게 담은 리스트를 삭제하거나 소속 리스트를 모두 해제하면 즐겨찾기에서 빠집니다. 카카오 리뷰는 ZIP에 저장되며, 회원당 같은 장소에 하나만 작성할 수 있습니다. [지도 저장 처리](../../backend/src/main/java/com/zip/backend/map/MapService.java) · [리뷰 처리](../../backend/src/main/java/com/zip/backend/map/PlaceReviewService.java)
