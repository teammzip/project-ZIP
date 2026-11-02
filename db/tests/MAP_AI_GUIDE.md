# 동네·지도·AI DB 검증

## 범위·준비

regions, region_neighbors, trash_schedules, place_categories, places, place_favorites, place_reviews, ai_topics, ai_conversations, ai_messages, ai_usage_daily를 검증합니다.

앞선 테스트 정리 후 zip_test의 새 연결에서 시작합니다. 가상 회원·동네·장소·주제를 자체 생성하며 실제 위치 조회, 지도 외부 API, AI 호출·사진 전송은 없습니다. 테스트 중 COMMIT·DDL·다른 START TRANSACTION을 실행하지 않습니다. 같은 연결을 유지합니다.

```sql
USE zip_test;
SHOW CREATE TABLE place_favorites;
SHOW CREATE TABLE ai_messages;
SHOW CREATE TABLE ai_usage_daily;
```

ai_messages.card_type은 SPEND_SUMMARY와 LINK를 포함해야 합니다. 구조가 다르면 최신 마이그레이션 적용 상태를 확인합니다.

## 정상 테스트

13_map_ai_positive.sql 전체 실행 후 K01~K16 모두 PASS가 예상 결과입니다. 마지막에 ROLLBACK합니다. 중간 오류로 멈추면 같은 연결에서 ROLLBACK하고 첫 오류를 확인합니다.

| ID | 검증 내용 |
|---|---|
| K01~K02 | 동네 계층·이웃 방향성·같은 요일의 다른 배출 종류 |
| K03~K04 | 장소·0도 좌표·회원별 즐겨찾기와 리뷰 |
| K05~K06 | 리뷰 평균·개수 자동 갱신 없음, 수동 평균 3.0·2건 반영 |
| K07 | 지도 표시 분류·검색어 JSON |
| K08 | 대화·질문·지출 카드·LINK 카드 저장 |
| K09 | 일별·회원별 사용량 구분·증가 |
| K10 | 파일 삭제 시 메시지 보존·첨부 번호 SET NULL |
| K11~K12 | 주제 삭제 시 대화 보존, 대화 삭제 시 메시지 CASCADE |
| K13~K14 | 장소 삭제 시 리뷰/즐겨찾기 삭제, 동네 삭제 시 관련 연결 변화 |
| K15~K16 | 회원 삭제·공통 데이터 및 타인 보존·최종 정리 |

K05의 PASS는 리뷰 집계가 자동 갱신되지 않는 사실을 확인합니다. 서버가 리뷰 변경·회원 탈퇴 시 재계산해야 합니다. K10은 스키마의 선택적 파일 FK 테스트이며 현재 AI 사진 미보관 정책 변경이 아닙니다. 실제 파일은 생성하지 않습니다. K14는 장소를 먼저 삭제한 뒤 동네를 삭제하는 절차입니다. 장소가 남아 있는 동네 삭제는 L13에서 차단 여부를 검사합니다.

## 오류 테스트

14_map_ai_negative.sql은 전체 실행하지 않습니다. L00 준비 블록부터 SAVEPOINT 다음 SELECT까지 한 번 실행하고 출력 ID를 확인합니다. 이어 L01~L13을 각각 선택 실행한 뒤 L99 정리 블록을 실행합니다.

| ID | 오류 | 키·컬럼 |
|---|---|---|
| L01 | 1062 | uk_regions_parent_id_name |
| L02 | 1062 | region_neighbors.PRIMARY |
| L03 | 1062 | uk_trash_schedules_region_weekday_type |
| L04 | 1062 | uk_place_categories_name |
| L05 | 1062 | place_favorites.PRIMARY |
| L06 | 1062 | uk_place_reviews_place_id_user_id |
| L07 | 1062 | ai_usage_daily.PRIMARY |
| L08 | 1062 | uk_ai_topics_code |
| L09 | 1451 | fk_places_category_id |
| L10 | 1451 | fk_regions_parent_id |
| L11 | 1452 | fk_ai_messages_conversation_id |
| L12 | 3140 | ai_messages.card_data Invalid JSON text |
| L13 | 1451 | fk_places_region_id |

예상 밖 성공은 FAIL을 기록하고 `ROLLBACK TO SAVEPOINT map_ai_negative_fixture;`로 준비 상태를 복구합니다. 다른 오류는 미확인입니다. 연결을 잃었다면 새 연결에서 준비부터 다시 시작합니다. 마지막 L99는 PASS여야 합니다.

## 결과와 한계

```text
MySQL 버전:
K01~K16: 각 PASS / FAIL / 미실행
L01~L13: 각 오류 번호 + 키·컬럼
L99: PASS / FAIL
최초 예상 밖 오류:
```

정적 대조를 거친 파일이며 실제 MySQL 실행 결과는 아직 확인하지 않았습니다. 별점 1~5, 위경도 범위, 요일 0~6, 동네 계층의 순환 금지, 카드 내부 스키마·허용 경로, JSON 설정 소유권, 사용량 한도·동시성·한국 날짜는 DB 제약만으로 보장되지 않습니다. 실제 지역 인증·위치 API·AI 처리·권한은 별도 검증합니다.

이번 결과까지 확인해도 모든 제약·경계값·마이그레이션 검증이 끝난 것은 아닙니다. 다음 단계에서 전체 44개 테이블 대비 실행 범위와 누락 제약을 정리하고 보완 테스트 및 마이그레이션을 진행합니다. 특히 parent_id=NULL인 최상위 지역 이름은 현재 복합 UNIQUE만으로 중복을 막지 못하는 MySQL NULL 규칙을 따릅니다.
