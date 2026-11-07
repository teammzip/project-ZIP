-- 20261102_requirements_hardening.sql까지 적용된 DB에 한 번만 실행.
-- 백업 후 쓰기 중단. DDL은 암묵 커밋되므로 실패 시 실제 구조부터 확인.
USE `zip`;

ALTER TABLE `user_settings`
  ADD COLUMN `home_address` VARCHAR(200) NULL COMMENT '현재 실제 거주 상세주소 — 동네 표시명 및 가입 주소와 구분',
  ADD COLUMN `ledger_category_settings` JSON NULL COMMENT '회원별 scope의 custom 카테고리와 order 배열 — NULL은 기본 목록',
  ADD CONSTRAINT `ck_settings_ledger_object` CHECK (`ledger_category_settings` IS NULL OR JSON_TYPE(`ledger_category_settings`) = 'OBJECT');

ALTER TABLE `bill_items`
  MODIFY COLUMN `tag` VARCHAR(24) NOT NULL DEFAULT '공과금' COMMENT '회원별 고정 지출 카테고리 이름';

ALTER TABLE `ledger_categories`
  MODIFY COLUMN `name` VARCHAR(24) NOT NULL COMMENT '분류 이름 — 회원별 표시 목록은 설정 JSON에서 관리',
  MODIFY COLUMN `color` VARCHAR(32) NOT NULL COMMENT '기본 표시 색 — 회원별 색은 설정 JSON 우선';
