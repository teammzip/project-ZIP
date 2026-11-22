-- 적용할 DB를 선택한 후 실행. 쓰레기 배출표(trash_schedules)를 전국 생활쓰레기 배출정보 표준데이터 형식으로 바꾼다.
-- 바뀌는 것: 안내 문구(description) 삭제 · 배출 시작 시각(start_time) · 배출장소(place) 추가 ·
--   같은 동네 · 종류 · 요일에 시각이나 장소가 다르면 여러 줄을 둘 수 있게 중복 방지 키를 바꿈.
-- 주의: 처음 실행할 때(description 칸이 아직 있을 때) 기존 배출표 행을 모두 지운다. 지금까지는 마포구 예시 6행뿐이었고,
--   실제 데이터는 trash_schedules_nationwide.sql(저장소 루트) 로 다시 넣는다. 다시 실행하면 이미 바뀐 부분은 건너뛴다.

-- 1) 예시 행 삭제: 예전 형식(description)일 때만. 새 칸을 NOT NULL 로 추가하려면 표가 비어 있어야 함
SET @trash_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'trash_schedules' AND column_name = 'description'),
  'DELETE FROM trash_schedules WHERE id > 0',
  'SELECT 1'
);
PREPARE trash_stmt FROM @trash_ddl;
EXECUTE trash_stmt;
DEALLOCATE PREPARE trash_stmt;

-- 2) 배출 시작 시각
SET @trash_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'trash_schedules' AND column_name = 'start_time'),
  'SELECT 1',
  'ALTER TABLE trash_schedules ADD COLUMN `start_time` TIME NOT NULL COMMENT ''배출 시작 시각 — 예: 18:00'' AFTER `waste_type`'
);
PREPARE trash_stmt FROM @trash_ddl;
EXECUTE trash_stmt;
DEALLOCATE PREPARE trash_stmt;

-- 3) 배출장소
SET @trash_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'trash_schedules' AND column_name = 'place'),
  'SELECT 1',
  'ALTER TABLE trash_schedules ADD COLUMN `place` VARCHAR(100) NOT NULL COMMENT ''배출장소 — 예: 내 집 혹은 내 점포 앞'' AFTER `start_time`'
);
PREPARE trash_stmt FROM @trash_ddl;
EXECUTE trash_stmt;
DEALLOCATE PREPARE trash_stmt;

-- 4) 새 중복 방지 키: 동네 · 종류 · 요일 · 시작 시각 · 장소가 모두 같은 줄만 막음
--    (옛 키보다 먼저 만듦: region_id 외래키가 region_id 로 시작하는 인덱스를 항상 필요로 함)
SET @trash_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'trash_schedules' AND index_name = 'uk_trash_schedules_slot'),
  'SELECT 1',
  'ALTER TABLE trash_schedules ADD UNIQUE KEY `uk_trash_schedules_slot` (`region_id`, `waste_type`, `weekday`, `start_time`, `place`)'
);
PREPARE trash_stmt FROM @trash_ddl;
EXECUTE trash_stmt;
DEALLOCATE PREPARE trash_stmt;

-- 5) 옛 중복 방지 키(동네 · 요일 · 종류당 한 줄) 삭제
SET @trash_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'trash_schedules' AND index_name = 'uk_trash_schedules_region_weekday_type'),
  'ALTER TABLE trash_schedules DROP INDEX `uk_trash_schedules_region_weekday_type`',
  'SELECT 1'
);
PREPARE trash_stmt FROM @trash_ddl;
EXECUTE trash_stmt;
DEALLOCATE PREPARE trash_stmt;

-- 6) 안내 문구 삭제 (시작 시각 · 장소로 대신함)
SET @trash_ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'trash_schedules' AND column_name = 'description'),
  'ALTER TABLE trash_schedules DROP COLUMN `description`',
  'SELECT 1'
);
PREPARE trash_stmt FROM @trash_ddl;
EXECUTE trash_stmt;
DEALLOCATE PREPARE trash_stmt;

-- 7) 표 설명 갱신
ALTER TABLE trash_schedules COMMENT = '쓰레기 배출 일정: 동네(시군구)별 종류 · 요일 · 시작 시각 · 배출장소. 출처: 전국생활쓰레기배출정보표준데이터';
