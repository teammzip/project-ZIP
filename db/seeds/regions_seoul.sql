-- 동네 기본 데이터: 서울특별시와 25개 구 (regions level 1 · 2)
-- 회원 주소의 구 이름으로 users.region_id 를 찾을 때 씁니다 (backend auth/RegionMatcher). 지도 예시 장소(map_places_demo.sql)도 마포구가 있어야 들어가요.
-- 다시 실행해도 같은 동네가 두 번 들어가지 않아요. 다른 시·도는 필요할 때 같은 방식으로 추가하세요.
USE `zip`;

INSERT INTO `regions` (`parent_id`, `name`, `level`)
SELECT NULL, '서울특별시', 1
WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = '서울특별시');

INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`)
SELECT seoul.id, gu.name, 2
FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '서울특별시' ORDER BY `id` LIMIT 1) seoul
CROSS JOIN (
  SELECT '종로구' AS name UNION ALL SELECT '중구' UNION ALL SELECT '용산구' UNION ALL SELECT '성동구' UNION ALL SELECT '광진구'
  UNION ALL SELECT '동대문구' UNION ALL SELECT '중랑구' UNION ALL SELECT '성북구' UNION ALL SELECT '강북구' UNION ALL SELECT '도봉구'
  UNION ALL SELECT '노원구' UNION ALL SELECT '은평구' UNION ALL SELECT '서대문구' UNION ALL SELECT '마포구' UNION ALL SELECT '양천구'
  UNION ALL SELECT '강서구' UNION ALL SELECT '구로구' UNION ALL SELECT '금천구' UNION ALL SELECT '영등포구' UNION ALL SELECT '동작구'
  UNION ALL SELECT '관악구' UNION ALL SELECT '서초구' UNION ALL SELECT '강남구' UNION ALL SELECT '송파구' UNION ALL SELECT '강동구'
) gu;

-- 이 데이터를 넣기 전에 주소를 저장한 회원: 주소에 든 구 이름으로 동네를 채워요 (이미 동네가 있는 회원은 그대로).
UPDATE `users` u
JOIN `regions` r ON r.`level` = 2 AND r.`parent_id` = (SELECT p.`id` FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '서울특별시' ORDER BY `id` LIMIT 1) p)
SET u.`region_id` = r.`id`
WHERE u.`region_id` IS NULL AND u.`address` LIKE '%서울%'
  AND CONCAT(' ', REPLACE(u.`address`, ',', ' '), ' ') LIKE CONCAT('% ', r.`name`, ' %');
