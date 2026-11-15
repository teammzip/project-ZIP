-- 2026-11-15 휴대전화 인증을 이메일 인증으로 교체
-- 바뀌는 것
--   users                : email 비어도 됨(NULL 허용), email_verified_at 추가, phone · phone_verified_at · uk_users_phone 삭제
--   phone_verifications  : 삭제 → email_verifications 새로 만듦 (phone 자리에 email)
--   password_resets      : method 에서 PHONE 값 삭제 (EMAIL 만 남김)
--   banned_identities    : 재가입 차단을 하지 않기로 해서 표 삭제
-- 20261115_kakao_place_favorites.sql 까지 적용된 DB 에 한 번만 실행합니다. 새 DB 는 최신 schema.sql 만 실행합니다.
-- ALTER · DROP 은 다시 실행하면 실패하므로 부분 실행 뒤에 파일 전체를 재실행하지 않습니다. DDL 은 암묵 커밋되며 롤백 파일은 제공하지 않습니다.
USE `zip`;

-- 사전 확인: 아래 두 값이 모두 0 이어야 합니다. 0 이 아니면 먼저 해당 회원 · 기록을 정리하고 진행합니다.
SELECT COUNT(*) AS password_resets_by_phone FROM `password_resets` WHERE `method` = 'PHONE';
SELECT COUNT(*) AS pending_phone_verifications FROM `phone_verifications` WHERE `consumed_at` IS NULL AND `expires_at` > NOW();

-- 1. users: 휴대전화 컬럼 삭제, 이메일 NULL 허용 유지, 이메일 인증 일시 추가
ALTER TABLE `users`
  DROP INDEX `uk_users_phone`,
  DROP COLUMN `phone`,
  DROP COLUMN `phone_verified_at`,
  MODIFY COLUMN `email` VARCHAR(100) NULL COMMENT '이메일 — 가입 화면에서는 인증을 거쳐 필수로 받음. 소셜 로그인은 제공 안 할 수 있어 비어 있을 수 있음. 아이디·비밀번호 찾기의 본인 확인에 씀',
  ADD COLUMN `email_verified_at` DATETIME NULL COMMENT '이메일 인증 일시 — 인증번호로 이메일을 확인한 시각 (인증 전은 비어 있음)' AFTER `email`;

-- 2. phone_verifications 삭제, email_verifications 새로 만들기
DROP TABLE IF EXISTS `phone_verifications`;

CREATE TABLE IF NOT EXISTS `email_verifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '인증 아이디 — 자동 증가',
  `purpose` ENUM('SIGNUP','FIND_ID','RESET_PASSWORD') NOT NULL COMMENT '인증 목적 — 가입 / 아이디 찾기 / 비밀번호 찾기',
  `email` VARCHAR(100) NOT NULL COMMENT '인증받는 이메일',
  `user_id` BIGINT UNSIGNED NULL COMMENT '대상 사용자 아이디 — 찾기일 때만 채움(가입 때는 비움). 탈퇴하면 함께 삭제',
  `code_hash` CHAR(64) NOT NULL COMMENT '인증번호(해시) — 6자리 번호를 해시로 저장',
  `attempt_count` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '틀린 횟수 — 횟수가 넘으면 잠금',
  `requested_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '인증번호 요청 일시',
  `expires_at` DATETIME NOT NULL COMMENT '인증번호 만료 일시 — 보통 3~5분',
  `verified_at` DATETIME NULL COMMENT '인증 성공 일시',
  `verified_token_hash` CHAR(64) NULL COMMENT '인증 완료 값(해시) — 인증 성공 때 발급. 가입·찾기 요청에 함께 보내는 값',
  `consumed_at` DATETIME NULL COMMENT '사용 일시 — 인증 완료 값을 가입·재설정에 쓴 시각(한 번만 사용)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_email_verifications_verified_token_hash` (`verified_token_hash`),
  KEY `idx_email_verifications_email_requested_at` (`email`, `requested_at`),
  CONSTRAINT `fk_email_verifications_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='이메일 인증: 메일로 보낸 인증번호 기록.';

-- 3. password_resets: method 에서 PHONE 삭제
ALTER TABLE `password_resets`
  MODIFY COLUMN `method` ENUM('EMAIL') NOT NULL DEFAULT 'EMAIL' COMMENT '본인 확인 방법 — 이메일 인증';

-- 4. banned_identities 삭제 (재가입 차단 없음)
DROP TABLE IF EXISTS `banned_identities`;
