# 수동 MySQL 검증 기록

사용자가 Workbench에서 실행해 전달한 결과를 기록합니다. 담당 에이전트가 실제 DB에 접속해 독립 실행한 결과와 구분합니다. 실행 일시·MySQL 버전은 아직 제공되지 않았습니다. 전체 44개 테이블 검증 완료를 의미하지 않습니다.

| 단계 | 결과 | 근거 |
|---|---|---|
| 주거·대출 P01~P10 | 통과(사용자 보고) | 모두 PASS 전달 |
| 주거·대출 N01~N08 | 오류 발생 보고, 정확한 키 확인 미완료 | 각 예상 오류 번호·키 전체 미제공 |
| 주거·대출 N99 | 통과(사용자 보고) | PASS 전달 |
| 회원·인증 A01~A13 | 완료 보고 | 개별 결과표 미제공 |
| 회원·인증 B03·B05~B10 | 통과(전달 메시지 대조) | 1062 중복/1451 삭제 제한과 키 일치 |
| 회원·인증 B01·B02·B04·B99 | 완료 보고 | 개별 오류·결과표 미제공 |
| 생활 C01~C17 | 통과(사용자 보고) | 모두 PASS 전달 |
| 생활 D01~D09 | 통과(전달 메시지 대조) | 아래 오류 번호·키 일치 |
| 생활 D99 | 통과(사용자 보고) | PASS 전달 |
| 가계부 E01~E14 | 통과(사용자 보고) | 타입 수정 후 모두 PASS 전달 |
| 가계부 F01~F09 | 통과(전달 메시지 대조) | 아래 오류 번호·키 일치 |
| 가계부 F99 | 통과(사용자 보고) | PASS 전달 |
| 커뮤니티 G01~G13 | 통과(사용자 보고) | 모두 PASS 전달 |
| 커뮤니티 H01~H09 | 통과(전달 메시지 대조) | 1062 중복·1452 참조·1451 삭제 제한·1048 저장 주소 NULL 모두 예상과 일치 |
| 커뮤니티 H99 | 통과(사용자 보고) | PASS 전달 |
| 신고·제재·고객센터 I/J | 미실행 | 테스트 SQL 제공, 사용자 결과 대기 |

생활 오류 검증에서 확인한 결과:

- D01: 1062 / uk_event_categories_user_name
- D02: 1062 / uk_event_categories_user_system
- D03: 1062 / uk_event_presets_category_title
- D04: 1452 / fk_events_category_id
- D05~D06: 3819 / ck_events_anniversary_flags
- D07: 3819 / ck_memos_items_array
- D08: 3140 / memos.items의 Invalid JSON text
- D09: 1048 / body cannot be null

가계부 오류 검증에서 확인한 결과:

- F01: 1062 / uk_ledger_categories_kind_name
- F02: 1452 / fk_incomes_category_id
- F03: 1452 / fk_expenses_category_id
- F04: 1062 / uk_bill_payments_bill_item_id_period_ym
- F05: 1062 / uk_rent_payments_user_id_period_ym
- F06: 1451 / fk_incomes_category_id
- F07: 1451 / fk_expenses_category_id
- F08: 1452 / fk_bill_payments_bill_item_id
- F09: 1048 / amount cannot be null

다음은 커뮤니티·첨부 → 신고·제재·고객센터 → 동네·지도·AI → 미검증 제약·경계값 보완 및 마이그레이션 순서로 진행합니다. 서버 정책/권한/동시성은 API 구현 후 별도 검증합니다.
