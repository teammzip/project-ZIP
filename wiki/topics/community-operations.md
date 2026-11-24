# 커뮤니티·고객센터·관리자 운영

2026-11-24 확인 · GitHub `dev` `250b8d9` · [PR 원자료](../raw/pull-requests.md) · [위키 색인](../index.md)

## 동네 글과 조회 집계

- `here`는 회원의 동네, `near`는 내 동네와 전국 이웃 목록, `all`은 전체의 공개 글을 보여 줍니다. 주변 동네 탭의 `GET /api/posts/neighbors`와 주변 글 필터는 같은 지역 관계를 사용합니다. 글쓰기·댓글·공감 추가에는 30일 이내의 동네 인증이 필요합니다. [커뮤니티 API](../../backend/src/main/java/com/zip/backend/community/CommunityController.java) · [커뮤니티 서비스](../../backend/src/main/java/com/zip/backend/community/CommunityService.java) · [동네 인증](../../backend/src/main/java/com/zip/backend/region/RegionVerifyService.java) · [전국 이웃 데이터](database.md#전국-데이터)
- 홈의 동네 인기 글은 본인 동네에서 조회수 순으로 집계합니다. 운영자가 지정하는 자취 꿀팁은 별도로 조회합니다. [커뮤니티 API](../../backend/src/main/java/com/zip/backend/community/CommunityController.java) · [게시글 집계](../../backend/src/main/java/com/zip/backend/community/CommunityRepository.java)
- 게시글에는 본인 사진을 연결할 수 있고, 댓글·답글과 공감은 서버에 저장합니다. 글·댓글 신고는 신고 당시의 대상 내용을 보존하며, 운영자가 숨김·기각을 결정합니다. 다른 회원의 글·댓글 관리와 홈 꿀팁 지정은 관리자 권한이 필요합니다. [커뮤니티 서비스](../../backend/src/main/java/com/zip/backend/community/CommunityService.java) · [커뮤니티 관리 API](../../backend/src/main/java/com/zip/backend/community/AdminCommunityController.java)

### 본인 게시글 수

설정의 ‘내가 쓴 글’은 `GET /api/posts/my-count`가 반환한 `{ count }`를 사용합니다. 서버는 토큰으로 식별한 회원의 공개 게시글을 동네 범위와 관계없이 집계합니다. 모의 모드에서는 브라우저의 `zip-posts`에서 본인 글을 집계합니다. [게시글 집계 API 계약](../../frontend/API.md#7-커뮤니티--첨부--신고-) · [모의 모드의 브라우저 저장](../../frontend/API.md#브라우저-저장-localstorage) · [프론트 조회](../../frontend/src/features/community/useCommunity.ts) · [서버 집계](../../backend/src/main/java/com/zip/backend/community/CommunityRepository.java)

## 문의·공지·회원 제재

| 기능 | 운영 규칙 |
| --- | --- |
| 고객센터 | 회원은 본인 문의와 답변을 봅니다. 관리자는 문의당 한 번 답변할 수 있고, 먼저 등록된 답변을 동시 요청이 덮어쓰지 않습니다. 답변 시 회원에게 알림을 보냅니다. [문의 서비스](../../backend/src/main/java/com/zip/backend/support/SupportService.java) · [문의 저장](../../backend/src/main/java/com/zip/backend/support/SupportRepository.java) |
| 공지사항 | 회원은 고정·일반 공지와 팝업을 조회하고, 관리자만 등록·수정·삭제합니다. 등록 시 알림을 요청하면 알림을 켠 일반 회원에게 보냅니다. 팝업의 일주일 숨김은 회원별로 현재 브라우저에 저장합니다. [공지 서비스](../../backend/src/main/java/com/zip/backend/notice/NoticeService.java) · [팝업 저장](../../frontend/src/features/notice/popupStorage.ts) |
| 회원 제재 | 관리자는 경고·기간 정지·영구 정지와 해제를 관리합니다. 정지 중에는 기존 토큰을 쓰는 서버 요청도 차단합니다. 회원은 조치 이력을 볼 수 있고, 확인한 경고는 확인 시각을 남깁니다. [회원 제재 서비스](../../backend/src/main/java/com/zip/backend/moderation/ModerationService.java) · [서버 권한](../../backend/src/main/java/com/zip/backend/auth/SecurityConfiguration.java) |
| 장소 리뷰 신고 | 관리자 화면에서 장소 리뷰 신고를 기각하거나 리뷰를 삭제할 수 있습니다. 리뷰 삭제에 따른 사진 정리 규칙도 적용됩니다. [리뷰 서비스](../../backend/src/main/java/com/zip/backend/map/PlaceReviewService.java) · [지도 장소 식별자](map-place-ids.md) |

권한 분리, 관리자 처리와 사용자 알림은 커뮤니티·회원 제재·문의·공지 통합 테스트에 다뤄져 있습니다. 실제 환경별 검증은 [구현·검증 현황](project-status.md#검증된-부분)을 참고하세요. [커뮤니티 관리 테스트](../../backend/src/test/java/com/zip/backend/community/AdminCommunityIntegrationTests.java) · [회원 제재 테스트](../../backend/src/test/java/com/zip/backend/moderation/ModerationIntegrationTests.java) · [문의 테스트](../../backend/src/test/java/com/zip/backend/support/SupportIntegrationTests.java) · [공지 테스트](../../backend/src/test/java/com/zip/backend/notice/NoticeIntegrationTests.java)
