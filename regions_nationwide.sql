-- 동네 기본 데이터: 전국 시도(regions level 1) · 시군구(level 2). db/tools/trash_import.py 가 만든 파일 — 직접 고치지 말고 스크립트로 다시 만드세요.
-- 목록 기준: frontend/src/features/auth/data/regions.ts (2026-07-01 전남광주통합특별시 · 인천 개편 반영, 인천 중구 · 동구 · 서구도 포함).
-- 이미 있는 시도 · 시군구는 건너뛰어요(서울 25개 구 id 그대로). 다시 실행해도 같은 동네가 두 번 들어가지 않아요.
USE `zip`;

-- 서울특별시 (25)
INSERT INTO `regions` (`parent_id`, `name`, `level`) SELECT NULL, '서울특별시', 1 WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = '서울특별시');
INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`) SELECT s.id, g.name, 2 FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '서울특별시' ORDER BY `id` LIMIT 1) s CROSS JOIN (SELECT '강남구' AS name UNION ALL SELECT '강동구' AS name UNION ALL SELECT '강북구' AS name UNION ALL SELECT '강서구' AS name UNION ALL SELECT '관악구' AS name UNION ALL SELECT '광진구' AS name UNION ALL SELECT '구로구' AS name UNION ALL SELECT '금천구' AS name UNION ALL SELECT '노원구' AS name UNION ALL SELECT '도봉구' AS name UNION ALL SELECT '동대문구' AS name UNION ALL SELECT '동작구' AS name UNION ALL SELECT '마포구' AS name UNION ALL SELECT '서대문구' AS name UNION ALL SELECT '서초구' AS name UNION ALL SELECT '성동구' AS name UNION ALL SELECT '성북구' AS name UNION ALL SELECT '송파구' AS name UNION ALL SELECT '양천구' AS name UNION ALL SELECT '영등포구' AS name UNION ALL SELECT '용산구' AS name UNION ALL SELECT '은평구' AS name UNION ALL SELECT '종로구' AS name UNION ALL SELECT '중구' AS name UNION ALL SELECT '중랑구' AS name) g;

-- 부산광역시 (16)
INSERT INTO `regions` (`parent_id`, `name`, `level`) SELECT NULL, '부산광역시', 1 WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = '부산광역시');
INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`) SELECT s.id, g.name, 2 FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '부산광역시' ORDER BY `id` LIMIT 1) s CROSS JOIN (SELECT '강서구' AS name UNION ALL SELECT '금정구' AS name UNION ALL SELECT '기장군' AS name UNION ALL SELECT '남구' AS name UNION ALL SELECT '동구' AS name UNION ALL SELECT '동래구' AS name UNION ALL SELECT '부산진구' AS name UNION ALL SELECT '북구' AS name UNION ALL SELECT '사상구' AS name UNION ALL SELECT '사하구' AS name UNION ALL SELECT '서구' AS name UNION ALL SELECT '수영구' AS name UNION ALL SELECT '연제구' AS name UNION ALL SELECT '영도구' AS name UNION ALL SELECT '중구' AS name UNION ALL SELECT '해운대구' AS name) g;

-- 대구광역시 (9)
INSERT INTO `regions` (`parent_id`, `name`, `level`) SELECT NULL, '대구광역시', 1 WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = '대구광역시');
INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`) SELECT s.id, g.name, 2 FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '대구광역시' ORDER BY `id` LIMIT 1) s CROSS JOIN (SELECT '남구' AS name UNION ALL SELECT '달서구' AS name UNION ALL SELECT '달성군' AS name UNION ALL SELECT '동구' AS name UNION ALL SELECT '북구' AS name UNION ALL SELECT '서구' AS name UNION ALL SELECT '수성구' AS name UNION ALL SELECT '중구' AS name UNION ALL SELECT '군위군' AS name) g;

-- 인천광역시 (14)
INSERT INTO `regions` (`parent_id`, `name`, `level`) SELECT NULL, '인천광역시', 1 WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = '인천광역시');
INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`) SELECT s.id, g.name, 2 FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '인천광역시' ORDER BY `id` LIMIT 1) s CROSS JOIN (SELECT '강화군' AS name UNION ALL SELECT '검단구' AS name UNION ALL SELECT '계양구' AS name UNION ALL SELECT '미추홀구' AS name UNION ALL SELECT '남동구' AS name UNION ALL SELECT '동구' AS name UNION ALL SELECT '부평구' AS name UNION ALL SELECT '서구' AS name UNION ALL SELECT '서해구' AS name UNION ALL SELECT '연수구' AS name UNION ALL SELECT '영종구' AS name UNION ALL SELECT '옹진군' AS name UNION ALL SELECT '제물포구' AS name UNION ALL SELECT '중구' AS name) g;

-- 전남광주통합특별시 (27)
INSERT INTO `regions` (`parent_id`, `name`, `level`) SELECT NULL, '전남광주통합특별시', 1 WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = '전남광주통합특별시');
INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`) SELECT s.id, g.name, 2 FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '전남광주통합특별시' ORDER BY `id` LIMIT 1) s CROSS JOIN (SELECT '강진군' AS name UNION ALL SELECT '고흥군' AS name UNION ALL SELECT '곡성군' AS name UNION ALL SELECT '광산구' AS name UNION ALL SELECT '광양시' AS name UNION ALL SELECT '구례군' AS name UNION ALL SELECT '나주시' AS name UNION ALL SELECT '남구' AS name UNION ALL SELECT '담양군' AS name UNION ALL SELECT '동구' AS name UNION ALL SELECT '목포시' AS name UNION ALL SELECT '무안군' AS name UNION ALL SELECT '보성군' AS name UNION ALL SELECT '북구' AS name UNION ALL SELECT '서구' AS name UNION ALL SELECT '순천시' AS name UNION ALL SELECT '신안군' AS name UNION ALL SELECT '여수시' AS name UNION ALL SELECT '영광군' AS name UNION ALL SELECT '영암군' AS name UNION ALL SELECT '완도군' AS name UNION ALL SELECT '장성군' AS name UNION ALL SELECT '장흥군' AS name UNION ALL SELECT '진도군' AS name UNION ALL SELECT '함평군' AS name UNION ALL SELECT '해남군' AS name UNION ALL SELECT '화순군' AS name) g;

-- 대전광역시 (5)
INSERT INTO `regions` (`parent_id`, `name`, `level`) SELECT NULL, '대전광역시', 1 WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = '대전광역시');
INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`) SELECT s.id, g.name, 2 FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '대전광역시' ORDER BY `id` LIMIT 1) s CROSS JOIN (SELECT '대덕구' AS name UNION ALL SELECT '동구' AS name UNION ALL SELECT '서구' AS name UNION ALL SELECT '유성구' AS name UNION ALL SELECT '중구' AS name) g;

-- 울산광역시 (5)
INSERT INTO `regions` (`parent_id`, `name`, `level`) SELECT NULL, '울산광역시', 1 WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = '울산광역시');
INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`) SELECT s.id, g.name, 2 FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '울산광역시' ORDER BY `id` LIMIT 1) s CROSS JOIN (SELECT '남구' AS name UNION ALL SELECT '동구' AS name UNION ALL SELECT '북구' AS name UNION ALL SELECT '울주군' AS name UNION ALL SELECT '중구' AS name) g;

-- 세종특별자치시 (1)
INSERT INTO `regions` (`parent_id`, `name`, `level`) SELECT NULL, '세종특별자치시', 1 WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = '세종특별자치시');
INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`) SELECT s.id, g.name, 2 FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '세종특별자치시' ORDER BY `id` LIMIT 1) s CROSS JOIN (SELECT '세종특별자치시' AS name) g;

-- 경기도 (31)
INSERT INTO `regions` (`parent_id`, `name`, `level`) SELECT NULL, '경기도', 1 WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = '경기도');
INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`) SELECT s.id, g.name, 2 FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '경기도' ORDER BY `id` LIMIT 1) s CROSS JOIN (SELECT '가평군' AS name UNION ALL SELECT '고양시' AS name UNION ALL SELECT '과천시' AS name UNION ALL SELECT '광명시' AS name UNION ALL SELECT '광주시' AS name UNION ALL SELECT '구리시' AS name UNION ALL SELECT '군포시' AS name UNION ALL SELECT '김포시' AS name UNION ALL SELECT '남양주시' AS name UNION ALL SELECT '동두천시' AS name UNION ALL SELECT '부천시' AS name UNION ALL SELECT '성남시' AS name UNION ALL SELECT '수원시' AS name UNION ALL SELECT '시흥시' AS name UNION ALL SELECT '안산시' AS name UNION ALL SELECT '안성시' AS name UNION ALL SELECT '안양시' AS name UNION ALL SELECT '양주시' AS name UNION ALL SELECT '양평군' AS name UNION ALL SELECT '여주시' AS name UNION ALL SELECT '연천군' AS name UNION ALL SELECT '오산시' AS name UNION ALL SELECT '용인시' AS name UNION ALL SELECT '의왕시' AS name UNION ALL SELECT '의정부시' AS name UNION ALL SELECT '이천시' AS name UNION ALL SELECT '파주시' AS name UNION ALL SELECT '평택시' AS name UNION ALL SELECT '포천시' AS name UNION ALL SELECT '하남시' AS name UNION ALL SELECT '화성시' AS name) g;

-- 강원특별자치도 (18)
INSERT INTO `regions` (`parent_id`, `name`, `level`) SELECT NULL, '강원특별자치도', 1 WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = '강원특별자치도');
INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`) SELECT s.id, g.name, 2 FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '강원특별자치도' ORDER BY `id` LIMIT 1) s CROSS JOIN (SELECT '강릉시' AS name UNION ALL SELECT '고성군' AS name UNION ALL SELECT '동해시' AS name UNION ALL SELECT '삼척시' AS name UNION ALL SELECT '속초시' AS name UNION ALL SELECT '양구군' AS name UNION ALL SELECT '양양군' AS name UNION ALL SELECT '영월군' AS name UNION ALL SELECT '원주시' AS name UNION ALL SELECT '인제군' AS name UNION ALL SELECT '정선군' AS name UNION ALL SELECT '철원군' AS name UNION ALL SELECT '춘천시' AS name UNION ALL SELECT '태백시' AS name UNION ALL SELECT '평창군' AS name UNION ALL SELECT '홍천군' AS name UNION ALL SELECT '화천군' AS name UNION ALL SELECT '횡성군' AS name) g;

-- 충청북도 (11)
INSERT INTO `regions` (`parent_id`, `name`, `level`) SELECT NULL, '충청북도', 1 WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = '충청북도');
INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`) SELECT s.id, g.name, 2 FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '충청북도' ORDER BY `id` LIMIT 1) s CROSS JOIN (SELECT '괴산군' AS name UNION ALL SELECT '단양군' AS name UNION ALL SELECT '보은군' AS name UNION ALL SELECT '영동군' AS name UNION ALL SELECT '옥천군' AS name UNION ALL SELECT '음성군' AS name UNION ALL SELECT '제천시' AS name UNION ALL SELECT '증평군' AS name UNION ALL SELECT '진천군' AS name UNION ALL SELECT '청주시' AS name UNION ALL SELECT '충주시' AS name) g;

-- 충청남도 (15)
INSERT INTO `regions` (`parent_id`, `name`, `level`) SELECT NULL, '충청남도', 1 WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = '충청남도');
INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`) SELECT s.id, g.name, 2 FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '충청남도' ORDER BY `id` LIMIT 1) s CROSS JOIN (SELECT '계룡시' AS name UNION ALL SELECT '공주시' AS name UNION ALL SELECT '금산군' AS name UNION ALL SELECT '논산시' AS name UNION ALL SELECT '당진시' AS name UNION ALL SELECT '보령시' AS name UNION ALL SELECT '부여군' AS name UNION ALL SELECT '서산시' AS name UNION ALL SELECT '서천군' AS name UNION ALL SELECT '아산시' AS name UNION ALL SELECT '예산군' AS name UNION ALL SELECT '천안시' AS name UNION ALL SELECT '청양군' AS name UNION ALL SELECT '태안군' AS name UNION ALL SELECT '홍성군' AS name) g;

-- 전북특별자치도 (14)
INSERT INTO `regions` (`parent_id`, `name`, `level`) SELECT NULL, '전북특별자치도', 1 WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = '전북특별자치도');
INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`) SELECT s.id, g.name, 2 FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '전북특별자치도' ORDER BY `id` LIMIT 1) s CROSS JOIN (SELECT '고창군' AS name UNION ALL SELECT '군산시' AS name UNION ALL SELECT '김제시' AS name UNION ALL SELECT '남원시' AS name UNION ALL SELECT '무주군' AS name UNION ALL SELECT '부안군' AS name UNION ALL SELECT '순창군' AS name UNION ALL SELECT '완주군' AS name UNION ALL SELECT '익산시' AS name UNION ALL SELECT '임실군' AS name UNION ALL SELECT '장수군' AS name UNION ALL SELECT '전주시' AS name UNION ALL SELECT '정읍시' AS name UNION ALL SELECT '진안군' AS name) g;

-- 경상북도 (22)
INSERT INTO `regions` (`parent_id`, `name`, `level`) SELECT NULL, '경상북도', 1 WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = '경상북도');
INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`) SELECT s.id, g.name, 2 FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '경상북도' ORDER BY `id` LIMIT 1) s CROSS JOIN (SELECT '경산시' AS name UNION ALL SELECT '경주시' AS name UNION ALL SELECT '고령군' AS name UNION ALL SELECT '구미시' AS name UNION ALL SELECT '김천시' AS name UNION ALL SELECT '문경시' AS name UNION ALL SELECT '봉화군' AS name UNION ALL SELECT '상주시' AS name UNION ALL SELECT '성주군' AS name UNION ALL SELECT '안동시' AS name UNION ALL SELECT '영덕군' AS name UNION ALL SELECT '영양군' AS name UNION ALL SELECT '영주시' AS name UNION ALL SELECT '영천시' AS name UNION ALL SELECT '예천군' AS name UNION ALL SELECT '울릉군' AS name UNION ALL SELECT '울진군' AS name UNION ALL SELECT '의성군' AS name UNION ALL SELECT '청도군' AS name UNION ALL SELECT '청송군' AS name UNION ALL SELECT '칠곡군' AS name UNION ALL SELECT '포항시' AS name) g;

-- 경상남도 (18)
INSERT INTO `regions` (`parent_id`, `name`, `level`) SELECT NULL, '경상남도', 1 WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = '경상남도');
INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`) SELECT s.id, g.name, 2 FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '경상남도' ORDER BY `id` LIMIT 1) s CROSS JOIN (SELECT '거제시' AS name UNION ALL SELECT '거창군' AS name UNION ALL SELECT '고성군' AS name UNION ALL SELECT '김해시' AS name UNION ALL SELECT '남해군' AS name UNION ALL SELECT '밀양시' AS name UNION ALL SELECT '사천시' AS name UNION ALL SELECT '산청군' AS name UNION ALL SELECT '양산시' AS name UNION ALL SELECT '의령군' AS name UNION ALL SELECT '진주시' AS name UNION ALL SELECT '창녕군' AS name UNION ALL SELECT '창원시' AS name UNION ALL SELECT '통영시' AS name UNION ALL SELECT '하동군' AS name UNION ALL SELECT '함안군' AS name UNION ALL SELECT '함양군' AS name UNION ALL SELECT '합천군' AS name) g;

-- 제주특별자치도 (2)
INSERT INTO `regions` (`parent_id`, `name`, `level`) SELECT NULL, '제주특별자치도', 1 WHERE NOT EXISTS (SELECT 1 FROM `regions` WHERE `parent_id` IS NULL AND `name` = '제주특별자치도');
INSERT IGNORE INTO `regions` (`parent_id`, `name`, `level`) SELECT s.id, g.name, 2 FROM (SELECT `id` FROM `regions` WHERE `parent_id` IS NULL AND `name` = '제주특별자치도' ORDER BY `id` LIMIT 1) s CROSS JOIN (SELECT '서귀포시' AS name UNION ALL SELECT '제주시' AS name) g;
