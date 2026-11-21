-- 적용할 DB를 선택한 후 실행. 쓰레기 배출표(trash_schedules)를 원본 CSV(전국생활쓰레기배출정보표준데이터)와 같은 모양으로 바꾼다:
--   한 줄 = 동네 · 배출장소, 종류(생활쓰레기 · 음식물 · 재활용)마다 배출 요일 · 배출 시작 시각 칸.
-- 이전 모양(종류 × 요일마다 한 줄, weekday · waste_type · start_time 칸)이면 표를 지우고 새로 만든다.
--   배출표는 공공데이터를 넣은 표라 다른 표가 참조하지 않고, 적용 후 trash_schedules_nationwide.sql(저장소 루트) 로 다시 넣는다.
-- 이미 새 모양이면 아무것도 하지 않는다(다시 실행 가능).

-- 1) 이전 모양이면 표 삭제
SET @trash_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'trash_schedules' AND column_name = 'weekday'),
  'DROP TABLE trash_schedules',
  'SELECT 1'
);
PREPARE trash_stmt FROM @trash_ddl;
EXECUTE trash_stmt;
DEALLOCATE PREPARE trash_stmt;

-- 2) 새 모양 (db/schema.sql 과 같음)
CREATE TABLE IF NOT EXISTS `trash_schedules` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '배출일정 아이디 — 자동 증가',
  `region_id` BIGINT UNSIGNED NOT NULL COMMENT '동네 아이디 — 시군구',
  `place` VARCHAR(100) NOT NULL COMMENT '배출장소 — 예: 내 집 혹은 내 점포 앞',
  `general_days` SET('일','월','화','수','목','금','토') NOT NULL DEFAULT '' COMMENT '생활쓰레기 배출 요일 — 예: 월,수,금 (없으면 빈 값)',
  `general_time` TIME NULL COMMENT '생활쓰레기 배출 시작 시각 — 배출 요일이 없으면 비움',
  `food_days` SET('일','월','화','수','목','금','토') NOT NULL DEFAULT '' COMMENT '음식물쓰레기 배출 요일',
  `food_time` TIME NULL COMMENT '음식물쓰레기 배출 시작 시각',
  `recycle_days` SET('일','월','화','수','목','금','토') NOT NULL DEFAULT '' COMMENT '재활용품 배출 요일',
  `recycle_time` TIME NULL COMMENT '재활용품 배출 시작 시각',
  PRIMARY KEY (`id`),
  KEY `idx_trash_schedules_region_id` (`region_id`),
  CONSTRAINT `fk_trash_schedules_region_id` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_trash_any_day` CHECK (`general_days` <> '' OR `food_days` <> '' OR `recycle_days` <> ''),
  CONSTRAINT `ck_trash_day_time` CHECK ((`general_days` = '') = (`general_time` IS NULL) AND (`food_days` = '') = (`food_time` IS NULL) AND (`recycle_days` = '') = (`recycle_time` IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='쓰레기 배출 일정: 동네(시군구) · 배출장소별 생활쓰레기 · 음식물 · 재활용 배출 요일과 시작 시각. 출처: 전국생활쓰레기배출정보표준데이터';
