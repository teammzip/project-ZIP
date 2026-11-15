-- 2026-11-15 적용 확인용 (조회만 합니다. 데이터는 바꾸지 않아요)
-- mysql -u <계정> -p --default-character-set=utf8mb4 zip < db/verify_20261115.sql
USE `zip`;

-- 1. 이메일 전환: 모두 PASS 여야 해요
SELECT '1-1 users: phone 컬럼 없음' AS 확인,
  IF(COUNT(*) = 0, 'PASS', 'FAIL') AS 결과
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('phone', 'phone_verified_at');

SELECT '1-2 users: email NULL 허용 + email_verified_at 있음' AS 확인,
  IF(SUM(COLUMN_NAME = 'email' AND IS_NULLABLE = 'YES') = 1 AND SUM(COLUMN_NAME = 'email_verified_at') = 1, 'PASS', 'FAIL') AS 결과
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users';

SELECT '1-3 email_verifications 있음, phone_verifications · banned_identities 없음' AS 확인,
  IF(SUM(TABLE_NAME = 'email_verifications') = 1 AND SUM(TABLE_NAME IN ('phone_verifications', 'banned_identities')) = 0, 'PASS', 'FAIL') AS 결과
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE();

SELECT '1-4 password_resets.method = ENUM(EMAIL)' AS 확인,
  IF(COLUMN_TYPE = "enum('EMAIL')", 'PASS', 'FAIL') AS 결과
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'password_resets' AND COLUMN_NAME = 'method';

-- 2. 카카오 즐겨찾기 표
SELECT '2 kakao_place_favorites 있음' AS 확인,
  IF(COUNT(*) = 1, 'PASS', 'FAIL') AS 결과
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'kakao_place_favorites';

-- 3. 서울 동네 (서울특별시 1 + 25개 구 이상)
SELECT '3 서울 동네 데이터' AS 확인,
  IF(SUM(level = 1 AND name = '서울특별시') >= 1 AND SUM(level = 2) >= 25, 'PASS', 'FAIL') AS 결과
FROM regions;

-- 4. 전체 표 개수 (44개)
SELECT '4 전체 표 개수' AS 확인, COUNT(*) AS 개수, IF(COUNT(*) = 44, 'PASS', 'CHECK') AS 결과
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE';

-- 5. 기존 회원이 그대로인지 (수는 달라질 수 있어요)
SELECT COUNT(*) AS 회원수 FROM users;

-- 눈으로 보기
SHOW COLUMNS FROM users;
SHOW CREATE TABLE email_verifications\G
