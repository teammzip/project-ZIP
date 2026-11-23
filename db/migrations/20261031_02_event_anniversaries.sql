-- 대상 DB를 선택하고 20261031_current_project.sql 적용 이후 실행합니다.
-- 구형 컬럼도 이 파일로 정리합니다. 실행 전 백업 및 쓰기 중단. DDL은 암묵 커밋됩니다.
SET NAMES utf8mb4;

SELECT COUNT(CASE WHEN COLUMN_NAME IN ('is_anniv', 'is_yearly') THEN 1 END),
       COUNT(CASE WHEN COLUMN_NAME IN ('is_anniversary', 'repeat_yearly') THEN 1 END)
INTO @zip_anniversary_legacy, @zip_anniversary_current
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events';

SET @zip_anniversary_has_check = EXISTS (
  SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events'
    AND CONSTRAINT_TYPE = 'CHECK' AND CONSTRAINT_NAME = 'ck_events_anniversary_flags'
);

SET @zip_anniversary_conflicts = IF(@zip_anniversary_legacy = 2 AND @zip_anniversary_current = 2, NULL, 0);
SET @zip_anniversary_sql = IF(@zip_anniversary_legacy = 2 AND @zip_anniversary_current = 2,
  'SELECT COUNT(*) INTO @zip_anniversary_conflicts FROM `events`
   WHERE NOT (`is_anniv` <=> `is_anniversary` AND `is_yearly` <=> `repeat_yearly`)', 'SELECT 1');
PREPARE zip_anniversary_stmt FROM @zip_anniversary_sql;
EXECUTE zip_anniversary_stmt;
DEALLOCATE PREPARE zip_anniversary_stmt;

-- 양쪽 값이 다르거나 컬럼 쌍이 불완전하면 원본을 보존하고 중단합니다.
SET @zip_anniversary_ready = @zip_anniversary_legacy IN (0,2) AND @zip_anniversary_current IN (0,2)
  AND COALESCE(@zip_anniversary_conflicts = 0, FALSE);
SELECT @zip_anniversary_legacy AS legacy_columns, @zip_anniversary_current AS current_columns,
       @zip_anniversary_conflicts AS conflicting_rows;
DROP TEMPORARY TABLE IF EXISTS `zip_anniversary_preflight`;
CREATE TEMPORARY TABLE `zip_anniversary_preflight` (
  `ready` TINYINT NOT NULL,
  CONSTRAINT `ck_zip_anniversary_preflight` CHECK (`ready` = 1)
);
INSERT INTO `zip_anniversary_preflight` VALUES (@zip_anniversary_ready);
DROP TEMPORARY TABLE `zip_anniversary_preflight`;

SET @zip_anniversary_check = 'ADD CONSTRAINT `ck_events_anniversary_flags` CHECK (`is_anniversary` IN (0,1) AND `repeat_yearly` IN (0,1) AND (`repeat_yearly` = 0 OR `is_anniversary` = 1))';
SET @zip_anniversary_sql = CASE
  WHEN NOT @zip_anniversary_ready THEN 'SELECT 1'
  WHEN @zip_anniversary_current = 0 AND @zip_anniversary_legacy = 0 THEN CONCAT('ALTER TABLE `events`
    ADD COLUMN `is_anniversary` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''기념일 여부 — API anniv, 할 일 완료 및 남은 일 집계에서 제외'',
    ADD COLUMN `repeat_yearly` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''매년 반복 여부 — API yearly, 기념일 원본 한 행만 저장'',
    ', @zip_anniversary_check)
  WHEN @zip_anniversary_current = 0 THEN CONCAT('ALTER TABLE `events`
    CHANGE COLUMN `is_anniv` `is_anniversary` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''기념일 여부 — API anniv, 할 일 완료 및 남은 일 집계에서 제외'',
    CHANGE COLUMN `is_yearly` `repeat_yearly` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''매년 반복 여부 — API yearly, 기념일 원본 한 행만 저장'',
    ', @zip_anniversary_check)
  WHEN @zip_anniversary_legacy = 2 THEN CONCAT('ALTER TABLE `events` DROP COLUMN `is_anniv`, DROP COLUMN `is_yearly`',
    IF(@zip_anniversary_has_check, '', CONCAT(', ', @zip_anniversary_check)))
  WHEN NOT @zip_anniversary_has_check THEN CONCAT('ALTER TABLE `events` ', @zip_anniversary_check)
  ELSE 'SELECT 1'
END;
PREPARE zip_anniversary_stmt FROM @zip_anniversary_sql;
EXECUTE zip_anniversary_stmt;
DEALLOCATE PREPARE zip_anniversary_stmt;

-- 기존 일정은 두 값이 0으로 유지됩니다. 제목/이모지로 기념일을 추측하여 변환하지 않습니다.
-- 브라우저 데이터 이전 시 anniv/yearly를 명시적으로 매핑해야 합니다.
