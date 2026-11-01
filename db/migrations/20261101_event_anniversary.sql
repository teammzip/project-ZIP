-- DEPRECATED: 신규 실행 금지. 정식 경로는 20261031_02_event_anniversaries.sql입니다.
-- 아래는 이미 적용된 DB의 이력 확인용입니다. 적용 여부와 데이터 정리는 README.md 참고.
-- 기념일(anniv) · 매년 반복(yearly) 칸 추가. 한 번만 실행합니다 (재실행하면 중복 컬럼 오류).
-- 새 DB는 ../schema.sql 에 이미 포함되어 있으므로 실행하지 않습니다.
ALTER TABLE `events`
  ADD COLUMN `is_anniv` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '기념일 여부 — 1이면 완료 체크 없이 D-day로 표시' AFTER `done_at`,
  ADD COLUMN `is_yearly` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '매년 반복 여부 — 기념일일 때만 사용' AFTER `is_anniv`;
