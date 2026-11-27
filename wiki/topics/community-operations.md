# 커뮤니티·고객센터·관리자 운영

2026-11-24 확인 · GitHub `dev` `250b8d9` · [PR 원자료](../raw/pull-requests.md) · [위키 색인](../index.md)

## 동네 글과 조회 집계

- `here`는 회원의 동네, `near`는 내 동네와 전국 이웃 목록, `all`은 전체의 공개 글을 보여 줍니다. 주변 동네 탭의 `GET /api/posts/neighbors`와 주변 글 필터는 같은 지역 관계를 사용합니다. 같은 관계는 로그인 없이 `GET /api/regions/{id}/neighbors`로도 볼 수 있습니다. 서버 없이 쓰는 모의 모드도 같은 전국 이웃 목록을 씁니다(스크립트가 DB 이웃 데이터와 함께 만드는 [프론트 이웃 목록](../../frontend/src/features/community/data/neighbors.ts), [모의 데이터](../../frontend/src/features/community/data/seed.ts)에서 다시 내보냄, 2026-11-24 이전에는 서울 4개 구 예시뿐). 글쓰기·댓글·공감 추가에는 30일 이내의 동네 인증이 필요합니다. [커뮤니티 API](../../backend/src/main/java/com/zip/backend/community/CommunityController.java) · [커뮤니티 서비스](../../backend/src/main/java/com/zip/backend/community/CommunityService.java) · [동네 인증](../../backend/src/main/java/com/zip/backend/region/RegionVerifyService.java) · [전국 이웃 데이터](database.md#전국-데이터)
- 홈의 동네 인기 글은 본인 동네에서 조회수 순으로 집계합니다. 운영자가 지정하는 자취 꿀팁은 별도로 조회합니다. [커뮤니티 API](../../backend/src/main/java/com/zip/backend/community/CommunityController.java) · [게시글 집계](../../backend/src/main/java/com/zip/backend/community/CommunityRepository.java)
- 게시글에는 본인 사진을 연결할 수 있고, 댓글·답글과 공감은 서버에 저장합니다. 글·댓글 신고는 신고 당시의 대상 내용을 보존하며, 운영자가 숨김·기각을 결정합니다. 다른 회원의 글·댓글 관리와 홈 꿀팁 지정은 관리자 권한이 필요합니다. [커뮤니티 서비스](../../backend/src/main/java/com/zip/backend/community/CommunityService.java) · [커뮤니티 관리 API](../../backend/src/main/java/com/zip/backend/community/AdminCommunityController.java)
- 커뮤니티 화면은 동네 인증 뒤에만 열립니다. 서버 모드에서는 서버(DB)의 회원 동네와 인증 시각(`regionVerifiedAt`, 30일 유효)으로 판정합니다. 이 브라우저에 인증한 동네 이름이 없으면(다른 기기에서 인증했거나 브라우저 데이터를 지움) 로그인 응답의 회원 동네 이름(`region.fullName`을 `서울 중구`처럼 줄인 이름, 없으면 `region.name`)을 씁니다. 날씨·지도도 같은 동네를 씁니다([홈 날씨 위치](service-integrations.md#홈-날씨-위치)). 2026-11-26 전에는 브라우저의 동네 이름이 비면 서버에 인증이 있어도 다시 인증하라는 안내가 떴습니다. [입구](../../frontend/src/features/life/components/RegionAccessGate.tsx) · [인증 판정](../../frontend/src/features/life/derive.ts) · [판정 규칙](../../frontend/src/features/life/regionVerification.ts) · [판정 테스트](../../frontend/tests/region-verify-server.test.mjs)

### 본인 게시글 수

설정의 ‘내가 쓴 글’은 `GET /api/posts/my-count`가 반환한 `{ count }`를 사용합니다. 서버는 토큰으로 식별한 회원의 공개 게시글을 동네 범위와 관계없이 집계합니다. 모의 모드에서는 브라우저의 `zip-posts`에서 본인 글을 집계합니다. [게시글 집계 API 계약](../../frontend/API.md#7-커뮤니티--첨부--신고-) · [모의 모드의 브라우저 저장](../../frontend/API.md#브라우저-저장-localstorage) · [프론트 조회](../../frontend/src/features/community/useCommunity.ts) · [서버 집계](../../backend/src/main/java/com/zip/backend/community/CommunityRepository.java)

### 게시글 응답 DTO

회원 게시글 목록과 검색 결과는 `PostResponse.Page`로 `items`와 `hasNext`를 반환합니다. 첫 페이지 검색 결과가 0건이면 [오타 교정 제안](#오타-교정-검색어-제안)의 `suggestedQuery`가 포함될 수 있습니다. [검색 정렬과 관련도](#검색-정렬과-관련도)의 필터·정렬을 적용해 최대 21건을 조회하고 표시할 최대 20건을 DTO로 변환합니다. 회원 목록·홈 인기 글·홈 꿀팁은 `comments`와 `attachments`를 생략합니다. 상세·등록·수정 응답과 관리자 목록에는 두 필드가 포함되며, 항목이 없으면 빈 배열을 반환합니다. 관리자 목록은 기존대로 검색어 전체 문자열과 최신순을 사용합니다. 댓글의 `parentId`는 답글이면 문자열 ID, 최상위 댓글이면 명시적 `null`입니다. [게시글 응답 타입](../../backend/src/main/java/com/zip/backend/community/PostResponse.java) · [서버 검색과 매핑](../../backend/src/main/java/com/zip/backend/community/CommunityService.java) · [프론트 응답 타입](../../frontend/src/features/community/server.ts) · [검색 페이지 회귀 테스트](../../backend/src/test/java/com/zip/backend/community/CommunityIntegrationTests.java)

## 게시글 검색과 Elasticsearch 도입 검토

2026-11-25 확인 · 로컬 `c3ed411`의 코드·스키마와 공식 문서 기준입니다. 운영 검색량, 게시글 건수, 응답 시간, 검색 품질은 측정하지 않았습니다.

- **당시 검색 방식.** 2026-11-25의 `GET /api/posts`는 공개 상태의 글에 동네 범위와 카테고리를 적용하고, `q`가 있으면 제목이나 본문에 검색어가 연속으로 포함된 글을 최신순으로 반환했습니다. 2026-11-26 이후의 검색 방식은 [검색 정렬과 관련도](#검색-정렬과-관련도)를 참고합니다. 지역·상태·정렬용 인덱스는 있으나 `LIKE '%검색어%'`의 문자열 조건을 일반 B-tree 범위 조회로 처리할 수는 없습니다. 실제 읽는 행 수는 필터와 실행 계획에 따라 달라집니다. [게시글 인덱스](../../db/schema.sql#L499) · [MySQL 범위 최적화](https://dev.mysql.com/doc/refman/8.0/en/range-optimization.html)
- **도입 후보.** 커뮤니티의 검색어가 있는 요청부터 비교하는 편이 적합합니다. Elasticsearch의 Nori로 한국어 형태소를 분석하고, BM25와 필드 가중치로 본문에 단어가 한 번 나온 글보다 제목이 검색 의도에 가까운 글을 위에 올릴 수 있습니다. `곰팡이 제거`와 `곰팡이를 제거하는 법` 같은 검색어·제목 조합을 품질 평가에 포함합니다. 동의어와 입력 중 추천은 수요가 확인된 뒤 별도로 튜닝합니다. 메모·일정은 회원별 조회 범위를 적용하는 기능이고, 지도 장소는 카카오 로컬 검색을 사용하므로 최초 비교 범위는 커뮤니티입니다. [Nori](https://www.elastic.co/docs/reference/elasticsearch/plugins/analysis-nori) · [BM25](https://www.elastic.co/docs/solutions/search/ranking) · [필드 가중치](https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-multi-match-query) · [가계부와 메모](ledger-memos.md) · [일정](calendar-notifications.md) · [지도 장소 검색](map-place-ids.md#장소-검색과-저장-리스트)
- **도입 비용.** 검색 서비스의 메모리·디스크·모니터링과 장애 대응이 추가됩니다. 인덱스가 늦게 갱신될 수 있으므로 MySQL을 원본으로 두고, 게시글 등록·수정·삭제·신고 숨김·회원 탈퇴를 인덱스에 반영해야 합니다. 검색 인덱스에서 후보 ID를 가져오고 MySQL에서 현재 공개 상태와 동네·카테고리 범위를 다시 확인하면 반영 지연 중에도 노출을 막을 수 있습니다. 재시도·재색인과 검색 장애 시 MySQL로 전환하는 경로를 검증합니다. [게시글 상태 전환](../../backend/src/main/java/com/zip/backend/community/CommunityRepository.java#L241) · [신고 처리](../../backend/src/main/java/com/zip/backend/community/CommunityRepository.java#L375) · [회원 탈퇴](../../backend/src/main/java/com/zip/backend/auth/AuthService.java#L239) · [인덱스 갱신](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/refresh-parameter) · [샤드 운영 비용](https://www.elastic.co/docs/deploy-manage/production-guidance/optimize-performance/size-shards)
- **판단 기준.** 운영 도입은 보류를 제안합니다. 같은 게시글과 대표 한국어 질의로 현재 `LIKE`, MySQL `FULLTEXT`의 한국어 지원 `ngram` 파서, Elasticsearch Nori를 비교합니다. 동네 범위별 API p95, 정답 글의 상위 5개 노출률, 결과 없음 비율, 삭제·숨김 후 미노출을 확인합니다. `ngram`은 기존 MySQL에서 비교할 수 있지만 문자 단위로 토큰화하므로 짧은 검색어와 부분 문자열의 결과 차이도 확인합니다. Elasticsearch가 품질 또는 부하 목표에서 운영 비용을 감수할 만큼 개선하면 게시글 검색부터 적용합니다. [MySQL ngram 전문 검색](https://dev.mysql.com/doc/refman/8.4/en/fulltext-search-ngram.html) · [MySQL 실행 계획과 실제 시간](https://dev.mysql.com/doc/refman/8.0/en/explain.html)

### 게시글 검색 비교 절차

같은 게시글 스냅샷을 담은 격리 MySQL과 Elasticsearch에서 현재 `LIKE`·최신순, `FULLTEXT`·`ngram`·관련도순, Nori·BM25·제목 가중치 설정을 비교합니다. 후보마다 제목·본문, 로그인 계정, `scope`, 카테고리, 페이지 크기를 동일하게 맞춥니다. MySQL의 `ngram` 토큰 크기와 검색 모드, Elasticsearch의 분석기와 가중치를 기록하고 튜닝에 사용한 검색어와 최종 채점용 검색어를 구분합니다. 기존 통합 테스트의 동네 범위 및 본문 검색 사례는 회귀 테스트의 출발점입니다. 해당 테스트는 H2를 사용하므로 `FULLTEXT`와 DB 성능은 실제 MySQL에서 검증합니다. [커뮤니티 통합 테스트](../../backend/src/test/java/com/zip/backend/community/CommunityIntegrationTests.java#L97) · [테스트 DB 설정](../../backend/src/test/resources/application-test.properties#L2) · [MySQL ngram](https://dev.mysql.com/doc/refman/8.4/en/fulltext-search-ngram.html) · [Nori 토큰 분석](https://www.elastic.co/docs/reference/elasticsearch/plugins/analysis-nori-tokenizer)

| 검증 영역 | 사례와 확인 기준 |
| --- | --- |
| 검색 품질 | 제목·본문 정확 일치, `곰팡이 제거`와 `곰팡이를 제거하는 법`, 복합어 띄어쓰기, 한 글자 `쌀`, 결과가 없어야 하는 검색을 포함합니다. 동의어·오타 보정은 기능을 켰을 때 개선과 오탐을 따로 평가합니다. 결과를 보기 전에 각 검색어의 의도와 관련 글을 표시하고, 방식별 상위 결과를 모아 빠진 판단을 보완합니다. 관련 글이 있는 질의의 상위 5개 성공률, 첫 관련 글의 순위, 결과 없음 비율과 정답이 없는 질의의 오탐을 집계합니다. [검색 순위 평가](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-rank-eval) |
| 범위와 화면 | 같은 제목을 내 동네·이웃·비이웃과 다른 카테고리에 준비해 `here`·`near`·`all`에서 반환할 ID를 확인합니다. 동네 미설정, 로그인·정지 상태, 빈 검색어, 40자와 41자, `%`·`_`·`!` 문자 입력을 포함합니다. 20건·21건 경계와 점수 동점에서 `hasNext`·더 보기의 중복과 누락을 확인합니다. 서버 모드에서 검색어·동네 탭을 바꿀 때는 기존 300ms 입력 대기와 새 결과 표시를 확인합니다. [서버 범위·페이지 규칙](../../backend/src/main/java/com/zip/backend/community/CommunityService.java#L60) · [검색어 검증](../../backend/src/main/java/com/zip/backend/community/CommunityService.java#L353) · [화면 검색 요청](../../frontend/src/features/community/components/CommunityBoard.tsx#L69) |
| 성능 | 동일한 데이터와 요청 부하로 세 후보의 `/api/posts` 응답 시간을 동네 범위와 첫 페이지·더 보기별로 측정합니다. p50·p95·오류율, MySQL에서 읽은 행과 CPU, 검색 인덱스 용량과 메모리를 기록합니다. Elasticsearch 후보의 응답 시간에는 후보 ID 검색과 MySQL 재조회가 포함됩니다. 예상 운영 규모와 데이터 증가 조건에서 검색과 글 쓰기가 겹치는 상황도 확인합니다. [MySQL 실행 계획](https://dev.mysql.com/doc/refman/8.0/en/explain.html) |
| 동기화와 장애 | 등록·수정 후 검색 가능해질 때까지 걸리는 시간을 측정합니다. 인덱스 갱신을 지연시켜도 글 삭제·신고 숨김·회원 탈퇴 직후 검색 응답에서 노출이 0건인지 확인합니다. 검색 후보를 걸러낸 뒤에도 유효한 글을 기준으로 `hasNext`가 계산되어야 합니다. 이전 갱신의 지연 재시도, 검색 서비스 타임아웃과 MySQL 대체, 복구 후 재색인을 검증합니다. [갱신의 검색 반영](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/refresh-parameter) |

동네 범위와 인증은 기존 [계약 차이 기록](../log.md#2026-11-25-record--elasticsearch-도입-근거-검토)을 참고합니다. 엔진 비교에는 `scope`를 명시하고 같은 로그인 상태를 사용합니다. 기본값 및 읽기 권한의 최종 합격 기준은 API 계약을 확정한 뒤 적용합니다. 공개 상태·범위 위반과 고정된 데이터에서의 페이지 중복·누락은 도입 차단 조건으로 제안합니다. 품질과 성능 목표는 채점 전에 정합니다.

`곰팡이 제거`가 들어간 예시 글로 두 가지 검증을 시작할 수 있습니다. 우리 동네의 오래된 제거 방법 글 A와 본문에서만 단어를 언급한 최신 글 B를 두고, 방법을 찾는 검색에서 A의 순위를 비교합니다. 이웃 동네 공개 글 C, 비이웃 공개 글 D, 숨김 글 E, 삭제 글 F를 추가합니다. 같은 카테고리에서 일치하는 이 글들만 준비했다면 `here`는 A·B, `near`는 A·B·C, `all`은 A·B·C·D가 기대 ID 집합입니다. E·F는 공개 상태에서 먼저 색인하고 상태 변경 후 색인 반영을 지연시켜 API 응답을 검사합니다. [동네 범위와 정렬 조건](../../backend/src/main/java/com/zip/backend/community/CommunityRepository.java#L115)

지역 범위 위반은 요청한 탭의 필터가 깨진 사례입니다. 비이웃의 공개 글은 `all`에서 조회할 수 있습니다. 삭제·숨김 글은 모든 범위에서 제외합니다. 목록 응답에 제목과 본문이 들어가므로 상세 페이지에서 차단해도 목록 응답에서 이미 내용이 노출될 수 있습니다. 한 건이라도 재현되면 순위·속도 개선과 별개로 운영 전환을 보류하고, MySQL의 현재 상태와 범위를 응답 직전에 확인하는 경로를 재검증합니다. [검색 결과 응답 필드](../../backend/src/main/java/com/zip/backend/community/CommunityService.java#L465) · [인덱스 반영 지연](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/refresh-parameter)

### 격리 검색 비교 결과

2026-11-25 로컬 실행 · `c3ed411` 작업 트리 기준 · MySQL 9.6.0, Elasticsearch 9.5.7과 Nori · 합성 게시글. 실제 Spring HTTP API에서 검색 부분만 임시 교체해 비교했습니다. MySQL `ngram`은 토큰 크기 2의 자연어 검색, Nori는 제목 가중치 3과 검색어 토큰의 AND 조건을 사용했습니다.

- `here`의 `곰팡이 제거`에서 방법 글은 현행 2위, `ngram` 1위, Nori 1위였습니다. Nori에서 같은 글은 `near` 2위, `all` 3위였습니다. 관련 글을 정한 검색어 9개에서 상위 5개 성공은 각각 8·8·9건, 1위는 7·8·9건입니다. 현행은 `분리 수거`에서 `분리수거` 글을, `ngram`은 한 글자 `쌀`에서 해당 글을 놓쳤습니다. 결과 없음 대조 질의는 세 가지 모두 0건을 반환했습니다.
- 세 방식의 `here`·`near`·`all`이 기대 ID 집합을 모두 반환했습니다. 운영자 신고 숨김과 작성자 삭제 후 Elasticsearch 원본 검색에는 두 글이 남았습니다. MySQL의 현재 공개 상태·지역·카테고리를 확인하는 시제품 API는 두 글의 ID와 본문을 모두 제외했습니다. 현행 검색의 순위와 범위 회귀 사례를 통합 테스트에 추가했고, 커뮤니티 테스트 17개가 통과했습니다. [검색 회귀 테스트](../../backend/src/test/java/com/zip/backend/community/AdminCommunityIntegrationTests.java#L127)

합성 게시글 10,014건에서 네 가지 검색어와 동시 요청 4개를 사용했습니다. 준비 요청 이후 조건별 96회씩 `/api/posts` 응답 전체를 측정했습니다. 아래는 p95의 밀리초 값입니다. 1,152개 측정 요청에서 오류는 0건입니다.

| 방식 | `here` 첫 페이지 | `here` 더 보기 | `all` 첫 페이지 | `all` 더 보기 |
| --- | ---: | ---: | ---: | ---: |
| 현행 `LIKE` | 18.87 | 15.50 | 13.57 | 11.42 |
| MySQL `ngram` | 27.33 | 43.44 | 19.45 | 18.92 |
| Elasticsearch Nori와 MySQL 확인 | 62.44 | 31.16 | 26.99 | 22.02 |

이 조건에서 두 후보는 순위를 일부 개선했고 현행의 p95가 가장 낮았습니다. 운영 반영 판단에는 실제 검색어 분포를 반영한 품질 평가와 운영 규모의 부하 검증이 남아 있습니다. 시제품에서는 삭제·숨김 인덱스 지연을 재현했습니다. 지속적인 인덱스 동기화와 장애 시 MySQL 대체는 후속 검증 대상입니다.

### 최신순과 제목 일치 우선 정렬 비교

2026-11-26 로컬 실행 · `8f2c998` 작업 트리 · 격리 MySQL 9.6.0과 Spring HTTP API. 두 방식 모두 기존 제목·본문 `LIKE`와 공개 상태·지역·카테고리 조건을 사용했습니다. 시제품은 검색어가 제목에 연속으로 포함된 글을 먼저 배치하고, 각 그룹에서 작성 시각과 ID 내림차순을 유지했습니다. [현행 검색 쿼리](../../backend/src/main/java/com/zip/backend/community/CommunityRepository.java#L115) · [LIKE 검색어 이스케이프](../../backend/src/main/java/com/zip/backend/common/Sql.java#L25)

| 검색 품질 | 현행 최신순 | 제목 일치 우선 |
| --- | ---: | ---: |
| 이전 실험의 정답 검색어 9개 · 1위 | 7/9 | 8/9 |
| 이전 실험의 정답 검색어 9개 · 상위 5개 | 8/9 | 8/9 |
| 정렬에 유리한 경우와 불리한 경우를 추가한 11개 · 1위 | 8/11 | 9/11 |
| 정렬에 유리한 경우와 불리한 경우를 추가한 11개 · 상위 5개 | 9/11 | 10/11 |

`곰팡이 제거` 방법 글은 2위에서 1위, 최신 본문 언급 6건이 앞선 `보일러 누수` 대처 글은 7위에서 1위로 올랐습니다. `주차 등록` 절차가 본문에 있는 글은 제목에만 검색어가 있는 잡담 글에 밀려 1위에서 2위로 내려갔습니다. `분리 수거`로 `분리수거` 글을 찾는 경우는 두 방식 모두 0건이었습니다. 정답이 없는 `우주망원경`도 두 방식 모두 0건이었습니다. 품질 평가는 합성 사례를 사용했습니다.

`here`·`near`·`all`에서 기대한 공개 글 ID를 모두 확인했습니다. 다른 카테고리의 글과 신고로 숨긴 글, 작성자가 삭제한 글은 두 방식의 목록에서 제외됐습니다. 고정 데이터 41건을 20·20·1건으로 조회했을 때 중복·누락 없이 `hasNext`가 `true`·`true`·`false`였습니다. `%`·`_`·`!`는 일반 문자로 검색됐고, 검색어가 없거나 공백만 있을 때는 기존 정렬과 일치했습니다. [페이지 규칙](../../backend/src/main/java/com/zip/backend/community/CommunityService.java#L60)

게시글 10,067건에서 검색어 4개와 동시 요청 4개를 사용했습니다. 준비 요청 후 지역·페이지·정렬 조합별 240회씩 측정하고 번갈아 요청 순서를 바꿨습니다. 격리 환경을 새로 띄워 두 번 반복했으며 총 5,760개 측정 요청에서 오류가 없었습니다. 표는 두 실행에서 측정한 HTTP API p95의 범위이며 단위는 ms입니다.

| 검색 범위와 페이지 | 현행 최신순 | 제목 일치 우선 |
| --- | ---: | ---: |
| `here` 첫 페이지 | 15.23–16.31 | 31.61–32.22 |
| `here` 더 보기 | 13.12–15.58 | 26.78–27.14 |
| `near` 첫 페이지 | 11.52–11.62 | 56.10–58.47 |
| `near` 더 보기 | 11.41–45.44 | 57.16–57.97 |
| `all` 첫 페이지 | 7.69–8.20 | 60.51–62.88 |
| `all` 더 보기 | 8.43–8.88 | 61.01–61.09 |

`곰팡이 제거`의 `EXPLAIN ANALYZE`에서 최신순은 인덱스를 역순으로 읽고 결과 21건을 모으면 멈췄습니다. `all` 첫 페이지에서 읽은 게시글 행은 최신순 210건, 제목 우선 10,065건이었습니다. 제목 우선은 공개 행을 검사한 뒤 검색어에 따른 제목 일치 여부를 기준으로 정렬했습니다. 첫 페이지와 더 보기의 p95는 두 실행의 모든 조건에서 제목 우선이 높았습니다. 이 구현은 운영 반영을 보류하고 현행 최신순을 유지하는 편이 적합합니다. 실제 검색어 분포와 운영 부하는 미측정입니다. [게시글 인덱스](../../db/schema.sql#L517)

### 검색 정렬과 관련도

2026-11-26 구현 · `8f2c998` 기반 작업 트리. 게시글 검색은 공개 상태·동네·카테고리를 적용하고 검색어를 공백 단위로 나눠 모든 단어가 제목이나 본문에 있는 글을 찾습니다. `분리 수거`로 `분리수거` 글도 찾을 수 있습니다. 관련도순은 연속 구문 일치를 우선하고, 같은 그룹 안에서 모든 단어가 제목과 본문 양쪽에 있는 글을 우선합니다. 검색어가 있으면 기본 관련도순, 없으면 최신순을 적용합니다. [게시글 검색 구현](../../backend/src/main/java/com/zip/backend/community/CommunityRepository.java#L116) · [검색 요청·정렬·교정 제안 계약](../../frontend/API.md#동네-게시글-검색)

한글 음절만 3자 이상 붙여 쓴 검색어는 제목과 본문의 일반 공백을 각각 제거해 비교합니다. `층간소음`으로 `층간 소음`을 찾을 수 있고, 두 필드 일치 여부가 같으면 관련도순에서 제목이 일치하는 글이 앞섭니다. 두 글자 이하, 여러 단어, 문자·숫자 혼합 검색어는 기존 단어 비교를 사용합니다. 검색 전에 공개 상태·동네·카테고리 범위를 적용하며, 제목과 본문 사이 또는 문장부호를 넘어 문자열을 합치지 않습니다. 서버와 모의 모드에 같은 규칙을 적용합니다. [SQL 검색과 순위](../../backend/src/main/java/com/zip/backend/community/CommunityRepository.java#L125) · [모의 검색](../../frontend/src/features/community/postSearch.ts)

동네생활의 정렬 메뉴에서 최신순, 조회순, 인기순, 관련도순을 선택할 수 있습니다. 빈 검색창에 검색어를 입력하면 관련도순으로 시작합니다. 검색 중 정렬을 직접 바꿀 수 있고, 검색어를 지우면 이전 목록 정렬로 돌아갑니다. 조회순은 누적 조회수, 인기순은 ‘지금 뜨는 동네 이야기’와 같은 공감 수 + 2 × 댓글 수를 사용합니다. 서버에서 정렬한 뒤 페이지를 나누고 모의 모드도 같은 기준을 사용합니다. 별도 홈 인기 글 API는 내 동네 공개 글을 누적 조회수로 최대 3개 조회합니다. 집계 API는 호출마다 공개 글의 조회수를 1 증가시킵니다. [동네생활 화면](../../frontend/src/features/community/components/CommunityBoard.tsx) · [모의 검색과 인기 점수](../../frontend/src/features/community/postSearch.ts) · [홈 인기 글 범위](../../backend/src/main/java/com/zip/backend/community/CommunityService.java#L107)

격리 MySQL 9.6.0에서 구현된 Spring API에 `sort`를 바꿔 요청했습니다. 정답이 정해진 합성 검색어 13개를 채점했고, 결과가 없어야 하는 대조 검색어는 모든 정렬에서 0건이었습니다. `곰팡이 제거`·`보일러 누수`에서는 관련도순이 정답을 각각 2위·7위에서 1위로 올렸습니다. `세탁기 배수`는 조회·인기 상위 글에 묻힌 정답을 관련도순이 1위에 배치했습니다. `입주 신고`는 제목과 본문에 단어가 나뉜 정답을 연속 구문이 있는 잡담 글이 앞서 관련도 2위였습니다.

| 정렬 기준 | 정답 1위 | 정답 상위 5개 | `here` 첫 페이지 p95 | `near` 첫 페이지 p95 | `all` 첫 페이지 p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 최신순 | 9/13 | 12/13 | 13.58 ms | 10.43 ms | 10.14 ms |
| 조회순 | 9/13 | 12/13 | 14.71 ms | 58.17 ms | 64.49 ms |
| 인기순 | 12/13 | 13/13 | 32.38 ms | 59.00 ms | 62.11 ms |
| 관련도순 | 12/13 | 13/13 | 31.98 ms | 58.29 ms | 64.76 ms |

응답 시간은 합성 게시글 10,073건에서 검색어 4개와 동시 요청 4개를 사용해 측정했습니다. 지역·페이지·정렬 조합별 128회, 측정 요청 총 3,072건에서 오류는 0건이었습니다. 네 정렬의 `here`·`near`·`all`에서 범위 밖·다른 카테고리·숨김·삭제 글의 노출은 0건입니다. 고정된 41건을 `20·20·1`건으로 모두 반환했고 특수문자 검색과 기본 정렬을 확인했습니다. 조회수와 반응이 요청 사이에 바뀌면 페이지 경계도 이동할 수 있습니다. 화면은 반복 수신한 글 ID를 한 번만 표시합니다. 운영 검색어 분포와 운영 응답 시간은 미측정입니다. 백엔드 커뮤니티 통합 테스트 18개와 프론트 빌드·린트를 통과했습니다. 모바일 WebKit의 모의 화면에서 기본값, 네 정렬, 조회수 표기와 세 동네 탭을 확인했습니다. 행정동이 붙은 모의 주소는 이웃 목록의 시·군·구 키로 비교합니다. [검색 회귀 테스트](../../backend/src/test/java/com/zip/backend/community/AdminCommunityIntegrationTests.java#L128) · [모의 동네 범위](../../frontend/src/features/community/components/CommunityBoard.tsx#L40)

#### 관련도순 적용 후 검증 후보

2026-11-26 제안 · 관련도순 기본값을 기준으로 대표 검색어 평가와 서버 모드 확인을 먼저 진행합니다. 평가용 검색어와 기대 게시글 ID를 결과 확인 전에 정합니다. 연속 구문이 잡담을 앞세우는 사례, 한국어 조사·복합어, 한 글자, 적합한 글이 없는 검색을 포함합니다. 동네 범위별 1위·상위 5개 적중률, 적합한 글이 있는데도 결과가 없는 비율, 첫 페이지와 더 보기의 API p95를 기록합니다. 검색 범위가 다른 요청은 명시적 `scope`로 재현하고, `scope` 생략과 인증 상태는 [계약 확인](#게시글-검색-비교-절차)에서 따로 다룹니다. 범위 밖·삭제·숨김 글의 노출은 0건을 확인합니다.

평가에서 관련 글이 내려가는 실패가 반복되면 관련도 규칙을 조정하고, 범위 안에 적합한 글이 없는 사례가 많으면 검색어 수정이나 사용자가 선택하는 범위 변경 안내를 검토합니다. 넓은 범위의 p95가 목표를 넘으면 현재 MySQL 실행 계획과 읽은 행 수를 먼저 확인합니다. 한국어 검색 누락 또는 부하 문제가 반복될 때 동일 평가셋으로 `ngram`·Nori를 다시 비교합니다. 현재 근거는 격리 데이터와 모의 화면입니다. [검색 정렬과 관련도](#검색-정렬과-관련도) · [현재 결과 없음 화면](../../frontend/src/features/community/components/CommunityBoard.tsx#L259)

#### 대표 검색어 30개 기준 평가

2026-11-26 실행 · `8f2c998` 기반 작업 트리의 Spring API와 격리 MySQL 9.6.0. 검색어 30개, 검색 의도, 주 평가 범위, 필요한 경우 카테고리, 관련 게시글 ID, 합성 게시글 66건을 실행 전에 `community-search-v1`으로 고정했습니다. 지역은 우리 동네·이웃·비이웃으로 구성했습니다. 적합한 글이 있는 25개와 선택한 범위·카테고리 등에 따라 적합한 글이 없어야 하는 대조 검색 5개를 주 평가로 사용했습니다. [고정 검색어와 기대 결과](../../db/tests/community-search/fixture-v1.json)

| 주 평가 지표 | 관련도순 | 최신순 |
| --- | ---: | ---: |
| 적합한 글이 1위 | 14/25 (56%) | 4/25 (16%) |
| 적합한 글이 상위 5개에 포함 | 22/25 (88%) | 22/25 (88%) |
| 적합한 글이 있으나 결과가 비어 있음 | 2/25 (8%) | 2/25 (8%) |
| 적합한 글이 있으나 응답 전체에 적합한 글이 없음 | 3/25 (12%) | 3/25 (12%) |
| 적합한 글이 없는 대조 검색에서 결과가 반환됨 | 1/5 (20%) | 1/5 (20%) |

정답 1위와 상위 5개는 같은 검색의 적합한 글 중 순위가 가장 높은 글을 기준으로 셉니다. `곰팡이 제거`, `보일러 누수`, `세탁기 배수`는 2위에서 1위로, `10% 할인`도 2위에서 1위로 올랐습니다. `입주 신고`는 절차 안내 글보다 검색 구문이 제목과 본문에 있는 일상 글이 앞서 2위였습니다. `분리배출`은 `분리 배출` 글을, 철자가 틀린 `방충망 교채`는 `방충망 교체` 글을 찾지 못했습니다. `층간소음`은 붙여 쓴 단어가 들어간 소설 글만 반환하고 `층간 소음 상담 절차` 글을 놓쳤습니다. `야간 공구 대여`는 실제 대여 정보가 없는 희망 글을 반환했습니다. [검색별 순위 원본](../../db/tests/community-search/baseline-v1.json)

기준 결과를 검색어별로 대조하면 최신순에서 적합한 글이 1위였던 4개는 관련도순에서도 1위였고, 10개에서 적합한 글이 새로 1위에 올랐습니다. 기본값은 관련도순을 유지하고 한국어 복합어의 띄어쓰기 때문에 적합한 글이 검색 후보에서 빠지는 두 사례를 우선 개선하는 편을 제안합니다. 띄어쓰기 보완은 기존 일치 결과가 잡담뿐인 사례에서도 평가합니다. 이후 고정 30개와 규칙 조정에 쓰지 않은 검색어에서 누락·상위 5개·1위, 범위·공개 상태, 응답 시간을 함께 검증합니다. [검색별 기준 결과](../../db/tests/community-search/baseline-v1.json) · [SQL의 검색 조건과 정렬](../../backend/src/main/java/com/zip/backend/community/CommunityRepository.java#L133)

검색어마다 `here`·`near`·`all`을 명시하고 관련도순·최신순·정렬 생략으로 총 270회 요청했습니다. 정렬 생략은 90개 검색어·범위 조합에서 관련도순과 일치했습니다. 고정 데이터에서 범위 밖·다른 카테고리·삭제·숨김 글 반환은 0건입니다. 관련도순의 범위별 상위 5개 적중은 `here` 17/20, `near` 21/24, `all` 23/26입니다. 범위마다 기대 게시글과 적합한 글이 있는 검색 수가 달라 범위 간 수치를 직접 비교하려면 공통 검색에 대한 결과를 확인합니다. 이번 점수는 합성 게시글 기준이며, 운영 검색어·운영 데이터·응답 시간은 측정하지 않았습니다.

Windows에서 JDK 17의 `JAVA_HOME`을 설정하고 `backend`에서 `./gradlew.bat bootJar`로 평가할 코드를 빌드합니다. 저장소 루트에서 `node db/tests/community-search/run.cjs`를 실행하면 격리 로컬 MySQL과 API를 시작하고 `db/private/community-search-*`에 결과를 남깁니다. 기본 설치 경로가 다르면 `ZIP_SEARCH_MYSQL_HOME`에 MySQL 설치 경로를 지정합니다. 후속 방식은 같은 `fixtureSha256`으로 실행하고 [기준 점수](../../db/tests/community-search/baseline-v1.json)와 비교합니다. [재실행 코드](../../db/tests/community-search/run.cjs)

#### 띄어쓰기 누락 개선 검증

2026-11-26 실행 · 격리 MySQL 9.6.0에서 변경 전후 Spring API를 비교했습니다. 고정 30개의 기준 파일과 기대 결과를 유지했습니다. 새 규칙 구현 전에 확정한 별도 7개에는 제목·본문의 띄어쓰기, 이웃 범위와 카테고리, 숨김·삭제, 두 글자 검색어, 문장부호 대조를 넣었습니다. [별도 평가 검색어와 기대 결과](../../db/tests/community-search/spacing-holdout-v1.json) · [변경 전후 결과](../../db/tests/community-search/spacing-results-v1.json)

| 관련도순 지표 | 고정 30개 전 → 후 | 별도 7개 전 → 후 |
| --- | ---: | ---: |
| 적합한 글이 1위 | 14/25 → 16/25 | 2/6 → 6/6 |
| 적합한 글이 상위 5개에 포함 | 22/25 → 24/25 | 2/6 → 6/6 |
| 적합한 글이 있으나 응답 전체에 적합한 글이 없음 | 3/25 → 1/25 | 4/6 → 0/6 |

`분리배출`은 빈 결과에서 안내 글 1위로, `층간소음`은 소설 글만 반환하던 결과에서 상담 글 1위로 바뀌었습니다. `방충망 교채` 오타는 여전히 해당 글을 놓칩니다. 기존 적합한 결과의 첫 순위는 두 평가의 주 범위에서 하락하지 않았습니다. 변경 후 두 평가의 검색 API 요청 333건에서 범위 밖·다른 카테고리·삭제·숨김 글 반환은 0건이고, 정렬 생략은 111개 검색어·범위 조합에서 관련도순과 일치했습니다. 커뮤니티 통합 테스트 20개, 프론트 검색 테스트 2개와 빌드·린트가 통과했습니다. [API 회귀 테스트](../../backend/src/test/java/com/zip/backend/community/AdminCommunityIntegrationTests.java) · [모의 검색 회귀 테스트](../../frontend/tests/community-post-search.test.mjs)

합성 게시글 1만 건·동시 요청 4개의 별도 부하 실험에서는 붙여 쓴 검색어 3개와 기존 단어 비교를 사용하는 검색어 3개로 첫 페이지와 더 보기를 측정했습니다. 총 3,072회 측정에서 오류는 0건입니다. 붙여 쓴 검색어의 전체 동네 첫 페이지 p95는 83.80 → 78.60ms였습니다. 변경 전후를 이 순서로 각 한 차례 실행했고 기존 단어 비교의 p95도 함께 낮아졌으므로 속도 차이를 변경의 효과로 귀속하기 어렵습니다. [범위·페이지별 성능 결과](../../db/tests/community-search/spacing-results-v1.json)

별도 검색어는 `node db/tests/community-search/run.cjs db/tests/community-search/spacing-holdout-v1.json`으로 재실행합니다. 이전 JAR을 선택하려면 `ZIP_SEARCH_JAR`에 그 경로를 지정합니다. [재실행 코드](../../db/tests/community-search/run.cjs)

품질 유지 검토에서는 전체 적중률과 검색어별 순위·누락을 함께 비교합니다. 고정 30개에서 검색별 상위 5개의 반환 항목을 합산하면 적합한 항목은 25개에서 27개로 늘었고, 적합 표시가 없는 항목은 24개로 같았습니다. 후속 변경에서는 정답이 없는 대조 검색에 생긴 새 결과와 각 검색의 기존 정답 순위 하락을 확인합니다. 검증용 검색어를 규칙 조정에 사용하게 되면 새 검증용 검색어를 미리 고정합니다. 범위 밖·숨김·삭제 글 반환은 0건을 유지하고, 속도는 동일한 부하에서 실행 순서를 번갈아 측정해 확인합니다. [고정 기대 결과](../../db/tests/community-search/fixture-v1.json) · [변경 전후 결과](../../db/tests/community-search/spacing-results-v1.json)

#### 오타 교정 검색어 제안

회원 검색 첫 페이지에서 결과가 0건이면 생활 검색어 목록과 한글 자모 하나가 다른 후보를 비교합니다. 동일한 동네 범위·카테고리에서 공개 글을 찾을 수 있는 후보가 정확히 하나일 때 `suggestedQuery`를 반환합니다. 후보는 검색어의 한 단어만 교정하고, 둘 이상의 공개 결과 후보가 있거나 후보 자체가 4개를 넘으면 생략합니다. 예를 들어 `방충망 교채`에서 ‘방충망 교체’로 검색을 선택하면 현재 동네·카테고리·정렬을 유지해 다시 검색합니다. 두 글자 이하의 검색어, 검색 결과가 있는 요청, 첫 페이지 이후, 관리자 목록은 제안하지 않습니다. [서버 후보 규칙](../../backend/src/main/java/com/zip/backend/community/CommunitySearchSuggestion.java) · [공개 결과 확인](../../backend/src/main/java/com/zip/backend/community/CommunityService.java#L60) · [교정 버튼](../../frontend/src/features/community/components/CommunityBoard.tsx)

2026-11-26 격리 MySQL 9.6.0의 Spring API에서 검색어와 기대 결과를 미리 적은 12개 사례를 평가했습니다. `방충망 교채`, `보일려 누수`, `폐건전찌 교환`, `24시간 약굳`의 네 사례에서 모두 제안을 받았고 다시 검색했을 때 기대 글이 1위였습니다. 변경 전 제안은 0/4였습니다. 정상 검색어, 짧은 검색어, 모호한 후보, 다른 카테고리, 숨김·삭제 글을 포함한 대조 사례 8개는 제안 0건을 유지했습니다. 세 동네 범위 전체에서는 예상 제안 9/9, 대조 27개에서 잘못된 제안 0건입니다. [고정 사례](../../db/tests/community-search/typo-holdout-v1.json) · [변경 전후 결과](../../db/tests/community-search/typo-results-v1.json)

기존 30개 검색어의 동네 범위별 90개 조합에서 직접 검색 결과와 순위가 유지됐고, `방충망 교채`는 제안으로 적합한 글에 도달했습니다. 두 평가에서 변경 후 API 요청 390건에 지역 범위 밖·다른 카테고리·숨김·삭제 글 반환은 0건이었습니다. 커뮤니티 통합 테스트 21개, 프론트 검색 테스트 3개, 프론트 빌드·린트와 모바일 WebKit 모의 화면의 교정 선택을 확인했습니다. 오타 사례는 `node db/tests/community-search/run.cjs db/tests/community-search/typo-holdout-v1.json`으로 다시 평가합니다. [API 회귀 테스트](../../backend/src/test/java/com/zip/backend/community/AdminCommunityIntegrationTests.java) · [모의 검색 테스트](../../frontend/tests/community-post-search.test.mjs)

#### 검색 품질 평가 보완점

2026-11-26 검토 · 고정 평가의 직접 검색에서 적합한 글은 25개 중 16개가 1위, 24개가 상위 5개에 들었습니다. `입주 신고`는 잡담 뒤에 절차 안내가 나왔고, `야간 공구 대여`는 실제 대여 정보가 없는 글을 반환했습니다. 현재 채점은 첫 적합 글의 순위를 기준으로 집계합니다. 다음 평가에서는 상위 5개를 적합·부분 적합·부적합으로 판단하고 지표와 함께 검색어별 판정 및 순위 변화를 남기는 편을 제안합니다. [검색별 기준 결과](../../db/tests/community-search/baseline-v1.json) · [교정 후 회귀 결과](../../db/tests/community-search/typo-results-v1.json) · [채점 코드](../../db/tests/community-search/run.cjs)

기존 30개는 회귀 비교에 사용하고, 개선 규칙과 별도로 새 검색어·검색 의도·기대 글을 실행 전에 고정합니다. 고정 30개의 주 평가 범위는 우리 동네 20개, 이웃과 전체가 각 5개이며, 교정용 별도 평가는 적합한 제안 4개와 대조 8개에 한정됐습니다. 새 평가는 지역명·장소명, 문장형 검색, 사전에 없는 오타, 적합한 글과 단순 언급 글이 섞인 경우를 포함합니다. 원문 검색의 순위와 교정 제안의 정확성·누락, 제안 선택 뒤 적합 글 도달을 각각 집계합니다. [고정 검색어](../../db/tests/community-search/fixture-v1.json) · [교정 평가 검색어](../../db/tests/community-search/typo-holdout-v1.json)

교정 후보의 공개 결과를 확인하는 추가 조회는 별도 API 시간 측정이 남았습니다. 같은 데이터와 동시 요청 수에서 일반 검색과 0건 검색을 나누고, 0건은 후보가 없는 경우와 후보를 확인하는 경우를 나눠 변경 전후 p95와 오류율을 비교합니다. 직접 검색과 교정 후 재검색에서 지역·카테고리 범위 밖 또는 숨김·삭제 글이 한 건이라도 반환되면 도입을 보류합니다. [후보 확인 경로](../../backend/src/main/java/com/zip/backend/community/CommunityService.java#L60) · [기존 띄어쓰기 부하 결과](../../db/tests/community-search/spacing-results-v1.json)

## 문의·공지·회원 제재

| 기능 | 운영 규칙 |
| --- | --- |
| 고객센터 | 회원은 본인 문의와 답변을 봅니다. 관리자는 문의당 한 번 답변할 수 있고, 먼저 등록된 답변을 동시 요청이 덮어쓰지 않습니다. 답변 시 회원에게 알림을 보냅니다. [문의 서비스](../../backend/src/main/java/com/zip/backend/support/SupportService.java) · [문의 저장](../../backend/src/main/java/com/zip/backend/support/SupportRepository.java) |
| 공지사항 | 회원은 고정·일반 공지와 팝업을 조회하고, 관리자만 등록·수정·삭제합니다. 등록 시 알림을 요청하면 알림을 켠 일반 회원에게 보냅니다. 팝업의 일주일 숨김은 회원별로 현재 브라우저에 저장합니다. [공지 서비스](../../backend/src/main/java/com/zip/backend/notice/NoticeService.java) · [팝업 저장](../../frontend/src/features/notice/popupStorage.ts) |
| 회원 제재 | 관리자는 경고·기간 정지·영구 정지와 해제를 관리합니다. 정지 중에는 기존 토큰을 쓰는 서버 요청도 차단합니다. 회원은 조치 이력을 볼 수 있고, 확인한 경고는 확인 시각을 남깁니다. [회원 제재 서비스](../../backend/src/main/java/com/zip/backend/moderation/ModerationService.java) · [서버 권한](../../backend/src/main/java/com/zip/backend/auth/SecurityConfiguration.java) |
| 장소 리뷰 신고 | 관리자 화면에서 장소 리뷰 신고를 기각하거나 리뷰를 삭제할 수 있습니다. 리뷰 삭제에 따른 사진 정리 규칙도 적용됩니다. 리뷰를 삭제해도 신고 목록에는 신고 당시의 작성자·내용·별점이 남고 `review.deleted`가 `true`가 됩니다. 목록 응답은 2026-11-27부터 `PlaceReviewResponse.AdminReport`이며, 칸은 이전과 같습니다. [리뷰 서비스](../../backend/src/main/java/com/zip/backend/map/PlaceReviewService.java) · [지도 장소 식별자](map-place-ids.md#지도-응답-dto) |

권한 분리, 관리자 처리와 사용자 알림은 커뮤니티·회원 제재·문의·공지 통합 테스트에 다뤄져 있습니다. 실제 환경별 검증은 [구현·검증 현황](project-status.md#검증된-부분)을 참고하세요. [커뮤니티 관리 테스트](../../backend/src/test/java/com/zip/backend/community/AdminCommunityIntegrationTests.java) · [회원 제재 테스트](../../backend/src/test/java/com/zip/backend/moderation/ModerationIntegrationTests.java) · [문의 테스트](../../backend/src/test/java/com/zip/backend/support/SupportIntegrationTests.java) · [공지 테스트](../../backend/src/test/java/com/zip/backend/notice/NoticeIntegrationTests.java)
