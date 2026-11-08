-- 2026-11-08 지도 장소에 카카오 로컬 API 출처 추가
-- 20261107_life_categories.sql 까지 적용된 DB 에 한 번 실행합니다. 새 DB 는 최신 schema.sql 만 실행합니다.
-- - places.source 에 'KAKAO' 추가 (기존 값 MANUAL · PUBLIC_DATA 유지)
-- - '기타' 장소 종류 추가: 검색으로 찾은 곳 중 기본 15종류에 안 맞는 곳 (칩에는 안 보임)
-- - 같은 출처의 같은 원본 장소는 한 줄만 (source_id 가 NULL 인 직접 입력 장소는 여러 줄 가능)
-- 사전 확인: 아래가 0줄이어야 UNIQUE 추가가 실패하지 않아요.
--   SELECT source, source_id, COUNT(*) FROM places WHERE source_id IS NOT NULL GROUP BY source, source_id HAVING COUNT(*) > 1;
USE `zip`;

ALTER TABLE `places`
  MODIFY `source` ENUM('MANUAL','PUBLIC_DATA','KAKAO') NOT NULL DEFAULT 'MANUAL' COMMENT '정보 출처 — 직접 입력 / 공공데이터 / 카카오 로컬 API',
  ADD UNIQUE KEY `uk_places_source_source_id` (`source`, `source_id`);

INSERT IGNORE INTO `place_categories` (`name`, `icon`, `sort_order`) VALUES ('기타', '📍', 99);
