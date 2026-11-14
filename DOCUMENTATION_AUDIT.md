# 프로젝트 문서 정합성 점검 (2026-11-07)

검토 기준: 로컬 HEAD c9a985c와 현재 작업 트리, frontend/src·db/schema.sql·마이그레이션/테스트 자산. 원격 저장소를 fetch해 비교한 결과는 아닙니다.

## 판정과 읽는 순서

검토 전 모든 문서가 최신 상태는 아니었습니다. 현재 구현 지침을 수정하고 과거 조사·검증 이력은 날짜와 범위를 명시했습니다. 백엔드 착수 시 frontend/API.md → db/README.md → db/PRE_BACKEND_REVIEW.md를 우선합니다. 최초 날짜의 이력 수치를 현재 수치로 일괄 덮어쓰지 않습니다.

현재 DB는 44테이블·358컬럼·71키·62FK·15CHECK·2VIEW입니다. 사용자 zip_test의 적용/감사/M·X·Y 결과는 사용자 보고이며 독립 MySQL 검증과 구분합니다. 백엔드 구현 완료를 뜻하지 않습니다.

> 2026-11-10: `frontend_analyze/` 폴더(분석 문서 6개)는 삭제됐어요. 아래 표에서 해당 항목을 뺐고, 과거 점검 이력의 개수(32개/33개)는 당시 기준이에요.

## 문서별 점검 — 기존 텍스트 문서 32개

| 문서 | 처리 | 범위/정정 내용 |
|---|---|---|
| [README.md](README.md) | 수정 | DB 없음·35테이블 설명을 현재 상태로 수정 |
| [frontend/README.md](frontend/README.md) | 수정 | 최신 API 안내 및 설문·대출·지원·날씨 폴더 추가 |
| [frontend/API.md](frontend/API.md) | 수정 | 최신 저장 위치·설문/대출/개인 분류 제안 및 현재 /ai 대화 저장 상태 반영 |
| [frontend/src/features/loan/README.md](frontend/src/features/loan/README.md) | 유지 | interest.ts/store.ts와 대출 계산·중지·스냅샷 규칙 대조 |
| [frontend/src/features/weather/README.md](frontend/src/features/weather/README.md) | 유지 | 위치 출처·캐시·날씨 코드 설명 확인; 외부 이용 정책의 현재성 재검증 제외 |
| [db/README.md](db/README.md) | 수정 | 44테이블·358컬럼 전체 상세 설명 및 현재 저장 계약 |
| [db/migrations/README.md](db/migrations/README.md) | 수정 | 최신 20261107까지 5개 경로와 재실행 금지 구분 |
| [db/HOUSING_AND_LOAN.md](db/HOUSING_AND_LOAN.md) | 유지 | 주거/대출 저장 계약; 날짜별 최초 검토 기준은 이력 |
| [db/LATEST_REQUIREMENTS.md](db/LATEST_REQUIREMENTS.md) | 이력 포함 유지 | 20261102 위치·신고 계약, 최신 생활 기능 문서로 후속 링크 |
| [db/LIFE_CATEGORIES.md](db/LIFE_CATEGORIES.md) | 유지 | 20261107 개인 분류·월별 납부·집 주소 및 X/Y 검증 |
| [db/PRE_BACKEND_REVIEW.md](db/PRE_BACKEND_REVIEW.md) | 수정 | 사용자 최신 적용 보고와 갱신된 API 문서 상태 반영 |
| [db/SECURITY.md](db/SECURITY.md) | 범위 명시 | 최초 보안 검토 당시 결과임을 표시; 전체 이력 보안 재감사 아님 |
| [db/tests/README.md](db/tests/README.md) | 수정 | 최신 진입점·111 정상/95 예상 오류·검증 파일 갱신 |
| [db/tests/SCHEMA_AUDIT_GUIDE.md](db/tests/SCHEMA_AUDIT_GUIDE.md) | 수정 | 감사 기준 358컬럼/15CHECK 및 보완 테스트 실행 상태 |
| [db/tests/MIGRATION_GUIDE.md](db/tests/MIGRATION_GUIDE.md) | 수정 | 19번 파일에 포함된 5개 이전 경로와 실제 검증 상태 |
| [db/tests/LATEST_REQUIREMENTS_GUIDE.md](db/tests/LATEST_REQUIREMENTS_GUIDE.md) | 수정 | Q/V/W는 20261102 단계, 현재 감사는 20261107 전체 기준임을 구분 |
| [db/tests/AUTH_TERMS_GUIDE.md](db/tests/AUTH_TERMS_GUIDE.md) | 수정 | 실행 미확인 표현을 검증 기록 참조로 변경 |
| [db/tests/COMMUNITY_GUIDE.md](db/tests/COMMUNITY_GUIDE.md) | 수정 | 실행 미확인 표현을 검증 기록 참조로 변경 |
| [db/tests/LEDGER_GUIDE.md](db/tests/LEDGER_GUIDE.md) | 수정 | 실행 미확인 표현을 검증 기록 참조로 변경 |
| [db/tests/MAP_AI_GUIDE.md](db/tests/MAP_AI_GUIDE.md) | 수정 | 최신 별점·좌표·요일 CHECK와 실제 실행 결과 반영 |
| [db/tests/MODERATION_GUIDE.md](db/tests/MODERATION_GUIDE.md) | 수정 | 실행 미확인 표현을 검증 기록 참조로 변경 |
| [db/tests/SUPPLEMENTAL_GUIDE.md](db/tests/SUPPLEMENTAL_GUIDE.md) | 수정 | 실행 미확인 표현을 검증 기록 참조로 변경 |
| [db/tests/LIFE_GUIDE.md](db/tests/LIFE_GUIDE.md) | 유지 | C/D 실행 순서·예상 제약 및 API 책임 구분 |
| [db/tests/RESULTS.md](db/tests/RESULTS.md) | 이력 추가 | 사용자 20261107 적용·M/X/Y 통과 보고 추가; 기존 수치 보존 |
| [외부API_정리.txt](외부API_정리.txt) | 과거 조사 | 서비스 후보 기록; 이메일 인증 등은 현재 PHONE 계약을 대체하지 않음 |
| [test.txt](test.txt) | 과거 분석 | 신고 미구현·UNIQUE 미반영·설문/대출 API 없음 설명에 정정 안내 |

이 점검표 자체를 추가한 뒤 텍스트 문서는 33개입니다. node_modules·.git·빌드 결과·db/private는 제외했습니다. SVG/PNG 구조도 2개는 보조 그림으로 별도 취급하며 이번에 렌더링/그림 내용 대조를 하지 않았습니다. 워크스페이스 밖 첨부·Trello·원격 문서는 포함하지 않았습니다.

## 최근 Git 반영 사항과 보완

- c9a985c (2026-11-07): 20261107 생활 분류 마이그레이션, 최신 스키마/감사 메타데이터, X/Y 테스트, 격리 검증 결과 등 18개 파일을 반영했습니다. 신규 저장 구조는 정적 정합성 검사를 통과했습니다.
- 1a41a75 / 2cf0890: 회원별 카테고리 추가/정렬·고정 지출 수정·여러 달 납부 처리의 저장 공간은 위 커밋에 반영됐습니다. API 설명과 주 문서의 상세 컬럼 표는 후속 작업 트리에서 수정했습니다.
- 최근 커밋에 남았던 주 문서의 356컬럼/14CHECK 표현, 테스트 가이드의 실행 미확인/옛 기대값, 루트의 DB 없음/35테이블 설명을 수정했습니다.
- 현재 변경은 미커밋 작업 트리입니다. 원격 push·PR·자동 커밋은 수행하지 않았습니다. 이번 문서 점검으로 새 테이블/마이그레이션을 추가하지 않았고 React 코드는 수정하지 않았습니다.

## 검증 및 한계

로컬 문서 링크 존재 여부, 최신 감사 수치와 스키마 메타데이터 일치, 마이그레이션/fixture 정적 검사 5개, diff 공백 오류를 확인합니다. 기존 독립 MySQL 실행 결과는 db/tests/VALIDATION_20261107.json(정상 111·예상 거부 95)에 있습니다. 이번 문서 정리에서 실제 사용자 DB를 다시 조회하거나 전체 SQL을 재실행하지 않았습니다.

외부 서비스 가격·무료 한도·최신 라이브러리 버전·법률 적정성·외부 URL 응답은 이번 점검 범위가 아닙니다. 해당 조사 자료는 현재성 검증 완료로 표시하지 않았습니다. 런타임 API 권한·동시성·운영 성능은 백엔드 구현 이후 검증 대상입니다.
