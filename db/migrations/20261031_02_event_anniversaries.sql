-- 기념일 기능 추가: 20261031_current_project.sql 적용 이후 한 번만 실행합니다.
-- 최신 schema.sql로 생성한 새 DB에는 실행하지 않습니다.
-- 실행 전 백업 및 쓰기 중단. DDL은 암묵 커밋되므로 실패 시 현재 상태를 확인하세요.
SET NAMES utf8mb4;
USE `zip`;

ALTER TABLE `events`
  ADD COLUMN `is_anniversary` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '기념일 여부 — API anniv, 할 일 완료 및 남은 일 집계에서 제외',
  ADD COLUMN `repeat_yearly` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '매년 반복 여부 — API yearly, 기념일 원본 한 행만 저장',
  ADD CONSTRAINT `ck_events_anniversary_flags` CHECK (`is_anniversary` IN (0,1) AND `repeat_yearly` IN (0,1) AND (`repeat_yearly` = 0 OR `is_anniversary` = 1));

-- 기존 일정은 두 값이 0으로 유지됩니다. 제목/이모지로 기념일을 추측하여 변환하지 않습니다.
-- 브라우저 데이터 이전 시 anniv/yearly를 명시적으로 매핑해야 합니다.
