-- ============================================================================
-- ZIP – 자취생 생활 도우미 : 데이터베이스 (MySQL 8.0.16 이상)
-- 2026-10-31: frontend/API.md와 현재 React 데이터 모델(메모·지도·프로필·고객센터 포함) 기준입니다.
--   · 표 41개 + 집계용 VIEW 2개
--   · 한글 설명: db/README.md, 기존 DB 변경: db/migrations/20261031_current_project.sql
-- 사용법:  mysql -u root -p < db/schema.sql      (zip 데이터베이스가 새로 만들어집니다)
-- 규칙:   금액은 원 단위 정수(INT), 단 user_settings.rent_amount는 화면과 같은 만원 단위, 날짜·시간은 DATE/TIME/DATETIME, 글자는 utf8mb4,
--         비밀번호·인증번호·토큰은 원문 대신 해시만 저장, 회원 탈퇴 시 개인 데이터는 CASCADE, 재가입 차단 해시만 별도 보존
-- ============================================================================
SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS `zip` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `zip`;

-- ----------------------------------------------------------------------------
-- 1. 계정 · 인증 · 약관
-- ----------------------------------------------------------------------------

-- 동네: 시·도와 구·군 같은 "동네" 목록. 사용자가 사는 동네, 커뮤니티 글의 동네, 쓰레기 배출표, 주변 장소가 모두 이 표를 가리킵니다. (내 정보의 "우리 동네", 커뮤니티의 "우리 동네 / 주변 동네 / 전체" 범위)
CREATE TABLE IF NOT EXISTS `regions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '동네 아이디 — 자동 증가',
  `parent_id` BIGINT UNSIGNED NULL COMMENT '상위 동네 아이디 — 시·도 → 구·군',
  `name` VARCHAR(30) NOT NULL COMMENT '동네 이름 — 예: 마포구',
  `level` TINYINT UNSIGNED NOT NULL COMMENT '동네 단계 — 1=시·도, 2=구·군',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_regions_parent_id_name` (`parent_id`, `name`),
  CONSTRAINT `fk_regions_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `regions` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='동네: 시·도와 구·군 같은 "동네" 목록.';

-- 주변 동네: 어느 동네가 어느 동네와 이웃한지 적어 둔 표. 커뮤니티의 "주변 동네" 범위로 글을 모아 볼 때 씁니다. (마포구 ↔ 서대문구·용산구·영등포구)
CREATE TABLE IF NOT EXISTS `region_neighbors` (
  `region_id` BIGINT UNSIGNED NOT NULL COMMENT '동네 아이디',
  `neighbor_region_id` BIGINT UNSIGNED NOT NULL COMMENT '주변 동네 아이디 — 이웃한 동네',
  PRIMARY KEY (`region_id`, `neighbor_region_id`),
  CONSTRAINT `fk_region_neighbors_region_id` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_region_neighbors_neighbor_region_id` FOREIGN KEY (`neighbor_region_id`) REFERENCES `regions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='주변 동네: 어느 동네가 어느 동네와 이웃한지 적어 둔 표.';

-- 사용자: 가입한 사람 한 명당 한 줄. 로그인 정보(아이디·비밀번호), 본인 확인 정보(휴대전화·이메일), 닉네임과 사는 동네를 담습니다. 개인 데이터는 이 표의 id를 따라갑니다. 탈퇴 시 연결된 개인 데이터는 삭제하고 재가입 차단 해시는 별도 보존합니다.
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '사용자 아이디 — 자동 증가',
  `login_id` VARCHAR(16) NULL COMMENT '로그인 아이디 — 일반 가입은 6~16자 영문 소문자·숫자 필수, 소셜 가입은 NULL 허용',
  `password_hash` VARCHAR(100) NULL COMMENT '비밀번호(해시) — 원문은 저장 안 함. 소셜 가입자는 비어 있음',
  `nickname` VARCHAR(12) NOT NULL COMMENT '닉네임 — 2~12자, 앱 인사말에 쓰임',
  `email` VARCHAR(100) NULL COMMENT '이메일',
  `phone` VARCHAR(11) NULL COMMENT '휴대전화 — 구분 기호 없이 숫자만 저장',
  `phone_verified_at` DATETIME NULL COMMENT '휴대전화 인증 일시 — 가입 때 인증을 마친 시각',
  `region_id` BIGINT UNSIGNED NULL COMMENT '사는 동네 아이디 — 내 정보의 "우리 동네"',
  `address` VARCHAR(200) NULL COMMENT '입력한 주소 — 가입할 때 쓴 주소 글자',
  `age_confirmed_at` DATETIME NULL COMMENT '만 14세 이상 확인 일시 — 가입 때 "만 14세 이상" 체크한 시각',
  `signup_provider` ENUM('EMAIL','KAKAO','GOOGLE','NAVER') NOT NULL DEFAULT 'EMAIL' COMMENT '가입 경로 — 화면의 provider 값. 소셜 첫 가입자는 약관·주소를 나중에 받음',
  `role` ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER' COMMENT '사용자 권한 — 운영자만 ADMIN',
  `status` ENUM('ACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE' COMMENT '이용 상태 — 이용 제한 중이면 SUSPENDED',
  `password_changed_at` DATETIME NULL COMMENT '비밀번호 변경 일시 — 내 정보·비밀번호 찾기로 바꾼 시각',
  `last_login_at` DATETIME NULL COMMENT '마지막 로그인 일시',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '가입 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '정보 수정 일시',
  `region_verified_at` DATETIME NULL COMMENT '동네 인증 일시 — 30일 유효, 동네 변경 시 NULL로 초기화',
  `home_lat` DECIMAL(9,6) NULL COMMENT '집 위치 위도 — 주소를 좌표로 변환한 값',
  `home_lon` DECIMAL(9,6) NULL COMMENT '집 위치 경도 — 주소를 좌표로 변환한 값',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_login_id` (`login_id`),
  UNIQUE KEY `uk_users_email` (`email`),
  UNIQUE KEY `uk_users_phone` (`phone`),
  CONSTRAINT `fk_users_region_id` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='사용자: 가입한 사람 한 명당 한 줄.';

-- 소셜 로그인 계정: 카카오·구글·네이버로 로그인한 사용자가 어느 소셜 계정인지 연결해 두는 표. 한 사용자가 여러 소셜을 연결할 수 있고, 같은 소셜 계정은 한 사용자에게만 붙습니다.
CREATE TABLE IF NOT EXISTS `social_accounts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '소셜계정 아이디 — 자동 증가',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '연결된 사용자 아이디',
  `provider` ENUM('KAKAO','GOOGLE','NAVER') NOT NULL COMMENT '소셜 서비스',
  `provider_user_id` VARCHAR(100) NOT NULL COMMENT '소셜 서비스 사용자 번호 — 소셜 쪽에서 준 고유 번호',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '연결 일시',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_social_accounts_provider_provider_user_id` (`provider`, `provider_user_id`),
  UNIQUE KEY `uk_social_accounts_user_id_provider` (`user_id`, `provider`),
  CONSTRAINT `fk_social_accounts_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='소셜 로그인 계정: 카카오·구글·네이버로 로그인한 사용자가 어느 소셜 계정인지 연결해 두는 표.';

-- 로그인 세션: 로그인한 기기마다 한 줄. 토큰 원문 대신 해시만 저장합니다. 로그아웃하면 revoked_at 이 채워지고, "로그인 유지"를 켜면 만료가 길어집니다.
CREATE TABLE IF NOT EXISTS `auth_sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '세션 아이디 — 자동 증가',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '로그인한 사용자 아이디',
  `refresh_token_hash` CHAR(64) NOT NULL COMMENT '재발급 토큰(해시) — 원문은 저장 안 함',
  `remember` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '로그인 유지 여부 — 로그인 창의 "로그인 유지" 체크',
  `user_agent` VARCHAR(255) NULL COMMENT '접속 기기 정보 — 브라우저 이름 등',
  `ip_address` VARCHAR(45) NULL COMMENT '접속 IP',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '로그인 일시',
  `expires_at` DATETIME NOT NULL COMMENT '만료 일시',
  `revoked_at` DATETIME NULL COMMENT '로그아웃(무효) 일시 — 비어 있으면 아직 유효',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_auth_sessions_refresh_token_hash` (`refresh_token_hash`),
  CONSTRAINT `fk_auth_sessions_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='로그인 세션: 로그인한 기기마다 한 줄.';

-- 휴대전화 인증: 문자로 보낸 인증번호 기록. 가입, 아이디 찾기, 비밀번호 찾기에서 같은 방식으로 씁니다. 인증에 성공하면 "인증 완료 값"이 발급되고, 가입 요청(가입 화면의 휴대전화 인증)이나 비밀번호 재설정(password_resets)에 그 값을 함께 보냅니다.
CREATE TABLE IF NOT EXISTS `phone_verifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '인증 아이디 — 자동 증가',
  `purpose` ENUM('SIGNUP','FIND_ID','RESET_PASSWORD') NOT NULL COMMENT '인증 목적 — 가입 / 아이디 찾기 / 비밀번호 찾기',
  `phone` VARCHAR(11) NOT NULL COMMENT '인증받는 휴대전화 — 숫자만',
  `user_id` BIGINT UNSIGNED NULL COMMENT '대상 사용자 아이디 — 찾기일 때만 채움(가입 때는 비움). 탈퇴하면 함께 삭제',
  `code_hash` CHAR(64) NOT NULL COMMENT '인증번호(해시) — 6자리 번호를 해시로 저장',
  `attempt_count` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '틀린 횟수 — 횟수가 넘으면 잠금',
  `requested_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '인증번호 요청 일시',
  `expires_at` DATETIME NOT NULL COMMENT '인증번호 만료 일시 — 보통 3분',
  `verified_at` DATETIME NULL COMMENT '인증 성공 일시',
  `verified_token_hash` CHAR(64) NULL COMMENT '인증 완료 값(해시) — 인증 성공 때 발급. 가입·찾기 요청에 함께 보내는 값',
  `consumed_at` DATETIME NULL COMMENT '사용 일시 — 인증 완료 값을 가입·재설정에 쓴 시각(한 번만 사용)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_phone_verifications_verified_token_hash` (`verified_token_hash`),
  KEY `idx_phone_verifications_phone_requested_at` (`phone`, `requested_at`),
  CONSTRAINT `fk_phone_verifications_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='휴대전화 인증: 문자로 보낸 인증번호 기록.';

-- 비밀번호 재설정 토큰: 비밀번호를 다시 정하도록 허락하는 1회용 토큰. 휴대전화 인증을 통과했을 때(시안의 바로 재설정)와 향후 이메일로 재설정 링크를 보낼 때(현재 미사용) 둘 다 이 표 한 줄로 처리합니다. 토큰은 해시만 저장하고, 한 번 쓰면 used_at 이 채워져 다시 쓸 수 없습니다.
CREATE TABLE IF NOT EXISTS `password_resets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '재설정 아이디 — 자동 증가',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '재설정하는 사용자 아이디',
  `method` ENUM('PHONE','EMAIL') NOT NULL COMMENT '본인 확인 방법 — 휴대전화 인증 / 이메일 링크',
  `token_hash` CHAR(64) NOT NULL COMMENT '재설정 토큰(해시) — 원문은 저장 안 함',
  `requested_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '요청 일시',
  `expires_at` DATETIME NOT NULL COMMENT '만료 일시 — 보통 10~30분',
  `used_at` DATETIME NULL COMMENT '사용 일시 — 비어 있으면 아직 안 씀',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_password_resets_token_hash` (`token_hash`),
  CONSTRAINT `fk_password_resets_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='비밀번호 재설정 토큰: 비밀번호를 다시 정하도록 허락하는 1회용 토큰.';

-- 약관 문서: 가입 화면에 보이는 약관의 본문과 버전. 서비스 이용약관, 개인정보 처리방침, 커뮤니티·AI 운영 정책 세 종류이고, 내용이 바뀌면 새 버전 줄을 추가합니다.
CREATE TABLE IF NOT EXISTS `terms_documents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '약관 아이디 — 자동 증가',
  `doc_type` ENUM('SERVICE','PRIVACY','POLICY') NOT NULL COMMENT '약관 종류 — 이용약관 / 개인정보 처리방침 / 운영 정책',
  `version` VARCHAR(20) NOT NULL COMMENT '약관 버전 — frontend LEGAL_VERSION과 동일 (예: 2026-10-18)',
  `title` VARCHAR(100) NOT NULL COMMENT '약관 제목',
  `content` MEDIUMTEXT NOT NULL COMMENT '약관 본문 — 조항 전체',
  `consent_kind` ENUM('AGREE','CONFIRM') NOT NULL COMMENT '받는 방식 — 동의(이용약관·운영정책) / 안내 확인(개인정보 처리방침)',
  `is_required` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '필수 여부 — 필수면 체크해야 가입 가능',
  `effective_at` DATETIME NOT NULL COMMENT '시행 일시',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_terms_documents_doc_type_version` (`doc_type`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='약관 문서: 가입 화면에 보이는 약관의 본문과 버전.';

-- 약관 동의 이력: 누가 어떤 약관(어느 버전)에 언제 동의했는지 남기는 표. 분쟁이 생기면 증거가 되므로 사용자가 탈퇴하기 전까지 보관합니다.
CREATE TABLE IF NOT EXISTS `user_term_agreements` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '동의 아이디 — 자동 증가',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '동의한 사용자 아이디',
  `terms_id` BIGINT UNSIGNED NOT NULL COMMENT '동의한 약관 아이디',
  `agreed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '동의 일시',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_term_agreements_user_id_terms_id` (`user_id`, `terms_id`),
  CONSTRAINT `fk_user_term_agreements_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_term_agreements_terms_id` FOREIGN KEY (`terms_id`) REFERENCES `terms_documents` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='약관 동의 이력: 누가 어떤 약관(어느 버전)에 언제 동의했는지 남기는 표.';

-- 회원 탈퇴 기록: 탈퇴가 있었다는 사실만 남기는 표(통계·문의 대응용). 탈퇴하면 개인정보와 개인 데이터는 모두 지워지므로 이름·연락처는 저장하지 않고, 사용자 번호도 연결(FK)하지 않습니다.
CREATE TABLE IF NOT EXISTS `withdrawal_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '탈퇴기록 아이디 — 자동 증가',
  `former_user_id` BIGINT UNSIGNED NOT NULL COMMENT '탈퇴한 사용자 번호 — 이미 지워진 번호(연결 없음)',
  `withdrawn_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '탈퇴 일시',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='회원 탈퇴 기록: 탈퇴가 있었다는 사실만 남기는 표(통계·문의 대응용).';

-- ----------------------------------------------------------------------------
-- 2. 마이페이지 · 생활 관리
-- ----------------------------------------------------------------------------

-- 사용자 설정: 내 정보 화면의 설정값(월세·월세 납부일·입주한 달·계약 끝나는 달·알림 수신). 사용자 한 명당 한 줄. 이름(닉네임)과 동네는 users 에 있습니다.
CREATE TABLE IF NOT EXISTS `user_settings` (
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '사용자 아이디',
  `rent_amount` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '월세 금액 — 만원 단위 (55 = 55만원)',
  `rent_day` TINYINT UNSIGNED NOT NULL DEFAULT 15 COMMENT '월세 납부일 — 매월 며칠 (1~31)',
  `move_in_ym` CHAR(7) NULL COMMENT '입주한 달 — 오른쪽 패널의 "거주 N개월" 계산 (예: 2026-02)',
  `contract_end_ym` CHAR(7) NULL COMMENT '계약 끝나는 달 — "계약 N개월 남음" 계산',
  `noti_on` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '알림 수신 여부 — 끄면 빨간 점·알림을 숨김',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '설정 수정 일시',
  `home_memo_ids` JSON NULL COMMENT '홈 메모 ID 문자열 배열 — NULL은 자동, 최대 3개, 배열 순서로 표시',
  `map_categories` JSON NULL COMMENT '지도에 표시할 장소 분류 이름 배열 — NULL은 기본 4개',
  `map_keywords` JSON NULL COMMENT '지도에서 직접 추가한 검색어 배열 — NULL은 없음',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_user_settings_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='사용자 설정: 내 정보 화면의 설정값(월세·월세 납부일·입주한 달·계약 끝나는 달·알림 수신).';

-- 할 일은 events.is_done / done_at으로 통합합니다. 기존 데이터 이전은 migrations를 참고하세요.

CREATE TABLE IF NOT EXISTS `event_categories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '고유 번호',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '소유 사용자 번호',
  `name` VARCHAR(20) NOT NULL COMMENT '일정 카테고리 이름',
  `ico` VARCHAR(20) NOT NULL DEFAULT '📌' COMMENT '카테고리 그림',
  `system_key` ENUM('UNCATEGORIZED') NULL COMMENT '미분류 식별값 — 이름 변경 및 삭제 불가',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '표시 순서',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_event_categories_user_name` (`user_id`, `name`),
  UNIQUE KEY `uk_event_categories_user_system` (`user_id`, `system_key`),
  CONSTRAINT `fk_event_categories_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='사용자별 일정 카테고리';

CREATE TABLE IF NOT EXISTS `event_presets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '고유 번호',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '소유 사용자 번호',
  `category_id` BIGINT UNSIGNED NOT NULL COMMENT '같은 사용자 소유 카테고리 번호',
  `title` VARCHAR(60) NOT NULL COMMENT '빠른 일정 항목 이름',
  `is_custom` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '직접 만든 항목이면 1, 기본 항목이면 0',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '카테고리 안 표시 순서',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_event_presets_category_title` (`category_id`, `title`),
  CONSTRAINT `fk_event_presets_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_event_presets_category_id` FOREIGN KEY (`category_id`) REFERENCES `event_categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='카테고리 아래의 기본 및 사용자 일정 항목 버튼';

-- 일정: 마이페이지 "일정" 탭의 달력과 일정 목록. 일정 추가·수정·삭제와 상단 검색의 대상이며, 가까운 일정은 알림으로도 보입니다. "월세 캘린더에 추가"로 자동 등록된 일정은 source 로 구분합니다.
CREATE TABLE IF NOT EXISTS `events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '일정 아이디 — 자동 증가',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '일정 주인 아이디',
  `title` VARCHAR(60) NOT NULL COMMENT '일정 제목',
  `event_date` DATE NOT NULL COMMENT '일정 날짜',
  `event_time` TIME NULL COMMENT '일정 시간 — 비우면 종일',
  `source` ENUM('USER','RENT') NOT NULL DEFAULT 'USER' COMMENT '등록 경로 — 직접 입력 / 월세 납부일 자동 등록',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시 — 일정 수정 기능이 갱신',
  `category_id` BIGINT UNSIGNED NULL COMMENT '일정 카테고리 번호 — NULL은 미분류',
  `is_done` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '할 일 완료 여부',
  `done_at` DATETIME NULL COMMENT '완료 일시 — 완료 해제 시 NULL',
  CONSTRAINT `fk_events_category_id` FOREIGN KEY (`category_id`) REFERENCES `event_categories` (`id`) ON DELETE SET NULL,
  PRIMARY KEY (`id`),
  KEY `idx_events_user_id_event_date` (`user_id`, `event_date`),
  CONSTRAINT `fk_events_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='일정: 마이페이지 "일정" 탭의 달력과 일정 목록.';

CREATE TABLE IF NOT EXISTS `memos` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '고유 번호',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '소유 사용자 번호',
  `title` VARCHAR(60) NOT NULL DEFAULT '' COMMENT '메모 제목 — 빈 제목 허용',
  `body` TEXT NOT NULL COMMENT '글 메모 내용 — API에서 생략 시 빈 문자열, 최대 5000자',
  `color` ENUM('노랑','분홍','하늘','초록','보라','흰색') NOT NULL DEFAULT '노랑' COMMENT '메모 색',
  `is_pinned` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '목록 상단 고정 여부',
  `is_checklist` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '체크리스트 여부',
  `items` JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '체크 항목 배열 — 각 항목은 text와 done, text 최대 100자',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  PRIMARY KEY (`id`),
  KEY `idx_memos_user_pinned_updated` (`user_id`, `is_pinned`, `updated_at`),
  CONSTRAINT `fk_memos_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ck_memos_items_array` CHECK (JSON_TYPE(`items`) = 'ARRAY')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='글 메모 및 체크리스트';

-- 공과금 항목: 내가 관리하는 공과금 종류(가스·전기·수도 등)와 평소 금액. 항목은 한 번 만들어 두고 달마다 납부 기록(bill_payments)을 붙입니다.
CREATE TABLE IF NOT EXISTS `bill_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '공과금 항목 아이디 — 자동 증가',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '공과금 주인 아이디',
  `name` VARCHAR(30) NOT NULL COMMENT '공과금 이름 — 가스, 전기, 수도 등',
  `default_amount` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '평소 금액 — 원 단위',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '사용 여부 — 해지한 항목은 0',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  `tag` ENUM('공과금','통신','구독','관리비','기타') NOT NULL DEFAULT '공과금' COMMENT '고정 지출 태그',
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bill_items_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='공과금 항목: 내가 관리하는 공과금 종류(가스·전기·수도 등)와 평소 금액.';

-- 공과금 납부: 공과금 항목별 월별 청구·납부 기록. 홈의 "이번 달 공과금 % 납부"와 공과금 상세 화면, 가계부의 고정 지출이 여기서 계산됩니다. paid_at 이 비어 있으면 미납입니다.
CREATE TABLE IF NOT EXISTS `bill_payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '공과금납부 아이디 — 자동 증가',
  `bill_item_id` BIGINT UNSIGNED NOT NULL COMMENT '공과금 항목 아이디',
  `period_ym` CHAR(7) NOT NULL COMMENT '대상 연월 — 예: 2026-10',
  `amount` INT UNSIGNED NOT NULL COMMENT '그 달 금액 — 원 단위',
  `paid_at` DATETIME NULL COMMENT '납부 일시 — 비어 있으면 미납',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bill_payments_bill_item_id_period_ym` (`bill_item_id`, `period_ym`),
  CONSTRAINT `fk_bill_payments_bill_item_id` FOREIGN KEY (`bill_item_id`) REFERENCES `bill_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='공과금 납부: 공과금 항목별 월별 청구·납부 기록.';

-- 월세 납부: 월별 월세 납부 기록. 월세 상세 화면의 최근 6개월 체크 목록, 홈 월세 D-day 카드, 가계부 고정 지출이 이 표를 씁니다. paid_at 이 비어 있으면 미납입니다.
CREATE TABLE IF NOT EXISTS `rent_payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '월세납부 아이디 — 자동 증가',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '월세 내는 사용자 아이디',
  `period_ym` CHAR(7) NOT NULL COMMENT '대상 연월 — 예: 2026-10',
  `amount` INT UNSIGNED NOT NULL COMMENT '그 달 월세 — 원 단위 (설정의 월세 × 10000)',
  `paid_at` DATETIME NULL COMMENT '납부 일시 — 비어 있으면 미납',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_rent_payments_user_id_period_ym` (`user_id`, `period_ym`),
  CONSTRAINT `fk_rent_payments_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='월세 납부: 월별 월세 납부 기록.';

-- 알림: 알림 화면과 빨간 점이 쓰는 표. 일정·쓰레기 배출·월세·공과금·커뮤니티 댓글 알림이 생길 때 한 줄씩 쌓이고, 누르면 read_at 이 채워져 "읽음"이 됩니다. 안 읽은 알림 개수가 메뉴·종·마이페이지 탭의 빨간 점이 됩니다.
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '알림 아이디 — 자동 증가',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '알림 받는 사용자 아이디',
  `noti_type` ENUM('EVENT','TRASH','RENT','BILL','COMMUNITY','SYSTEM') NOT NULL COMMENT '알림 종류',
  `title` VARCHAR(100) NOT NULL COMMENT '알림 제목',
  `body` VARCHAR(200) NULL COMMENT '알림 설명',
  `link_view` VARCHAR(20) NULL COMMENT '이동 화면 — 눌렀을 때 열 화면 이름',
  `ref_id` BIGINT UNSIGNED NULL COMMENT '관련 데이터 번호 — 일정·글 번호 등',
  `notify_at` DATETIME NOT NULL COMMENT '알릴 일시',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '생성 일시',
  `read_at` DATETIME NULL COMMENT '읽은 일시 — 비어 있으면 안 읽음',
  `deleted_at` DATETIME NULL COMMENT '사용자가 삭제한 시각 — 목록과 미확인 수에서 제외',
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_id_read_at` (`user_id`, `read_at`),
  CONSTRAINT `fk_notifications_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='알림: 알림 화면과 빨간 점이 쓰는 표.';

-- ----------------------------------------------------------------------------
-- 3. 가계부
-- ----------------------------------------------------------------------------

-- 가계부 분류: 수입 종류(월급·아르바이트·용돈 등)와 기타 지출 분류(식비·생활용품 등)를 한 표로 관리합니다. 화면의 칩 색깔도 여기서 가져옵니다. 월세·공과금은 별도 표(rent_payments, bill_payments)에서 옵니다.
CREATE TABLE IF NOT EXISTS `ledger_categories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '분류 아이디 — 자동 증가',
  `kind` ENUM('INCOME','EXPENSE') NOT NULL COMMENT '분류 구분 — 수입 / 기타 지출',
  `name` VARCHAR(20) NOT NULL COMMENT '분류 이름 — 월급, 식비 등',
  `color` VARCHAR(20) NOT NULL COMMENT '표시 색 — 예: #1fb5a3',
  `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '정렬 순서',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ledger_categories_kind_name` (`kind`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='가계부 분류: 수입 종류(월급·아르바이트·용돈 등)와 기타 지출 분류(식비·생활용품 등)를 한 표로 관리합니다.';

-- 수입: 가계부 "수입" 탭에서 기록하는 수입 한 건. 월별 합계·가장 큰 종류, 홈의 "월별 수입" 막대 그래프의 원본입니다.
CREATE TABLE IF NOT EXISTS `incomes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '수입 아이디 — 자동 증가',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '수입 주인 아이디',
  `category_id` BIGINT UNSIGNED NOT NULL COMMENT '수입 종류 아이디 — 월급, 아르바이트 등',
  `amount` INT UNSIGNED NOT NULL COMMENT '수입 금액 — 원 단위',
  `income_date` DATE NOT NULL COMMENT '번 날짜',
  `memo` VARCHAR(100) NULL COMMENT '메모 — 예: 주말 카페 알바',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '기록 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `income_type` ENUM('FIXED','OTHER') NOT NULL DEFAULT 'OTHER' COMMENT '고정 수입 또는 기타 수입 — API incomeType의 fixed/other와 변환',
  PRIMARY KEY (`id`),
  KEY `idx_incomes_user_id_income_date` (`user_id`, `income_date`),
  CONSTRAINT `fk_incomes_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_incomes_category_id` FOREIGN KEY (`category_id`) REFERENCES `ledger_categories` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='수입: 가계부 "수입" 탭에서 기록하는 수입 한 건.';

-- 기타 지출: 가계부 "지출 → 기타 지출" 탭에서 기록하는 지출 한 건(식비·생활용품·교통 등). 월별 보기, 홈의 "이번 달 지출 구성" 도넛, AI "이번 달 지출 요약" 카드가 월세·공과금과 합쳐 계산합니다.
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '지출 아이디 — 자동 증가',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '지출 주인 아이디',
  `category_id` BIGINT UNSIGNED NOT NULL COMMENT '지출 분류 아이디 — 식비, 교통 등',
  `amount` INT UNSIGNED NOT NULL COMMENT '지출 금액 — 원 단위',
  `expense_date` DATE NOT NULL COMMENT '쓴 날짜',
  `memo` VARCHAR(100) NULL COMMENT '메모 — 예: 점심 제육덮밥',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '기록 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  PRIMARY KEY (`id`),
  KEY `idx_expenses_user_id_expense_date` (`user_id`, `expense_date`),
  CONSTRAINT `fk_expenses_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_expenses_category_id` FOREIGN KEY (`category_id`) REFERENCES `ledger_categories` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='기타 지출: 가계부 "지출 → 기타 지출" 탭에서 기록하는 지출 한 건(식비·생활용품·교통 등).';

-- ----------------------------------------------------------------------------
-- 4. 커뮤니티 · 신고 · 이용 제한
-- ----------------------------------------------------------------------------

-- 커뮤니티 글: 커뮤니티의 글 한 개. 동네와 분류(자유·꿀팁·질문·동네)로 걸러 보고, 홈의 "자취 꿀팁"은 is_home_tip 이 켜진 꿀팁 글입니다. 좋아요·댓글 수는 목록을 빨리 보여주려고 글에 같이 적어 둡니다.
CREATE TABLE IF NOT EXISTS `posts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '글 아이디 — 자동 증가',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '글 작성자 아이디',
  `region_id` BIGINT UNSIGNED NOT NULL COMMENT '글 동네 아이디 — 어느 동네 글인지',
  `category` ENUM('FREE','TIP','QUESTION','TOWN') NOT NULL COMMENT '글 분류 — 자유 / 꿀팁 / 질문 / 동네',
  `title` VARCHAR(100) NOT NULL COMMENT '글 제목',
  `body` TEXT NOT NULL COMMENT '글 내용',
  `like_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '좋아요 수',
  `comment_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '댓글 수',
  `is_home_tip` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '홈 꿀팁 노출 — 켜면 홈에 보임',
  `status` ENUM('VISIBLE','HIDDEN','DELETED') NOT NULL DEFAULT 'VISIBLE' COMMENT '글 상태 — 신고로 숨김 / 삭제',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '작성 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  `deleted_at` DATETIME NULL COMMENT '삭제 일시 — 소프트 삭제',
  PRIMARY KEY (`id`),
  KEY `idx_posts_region_id_category_created_at` (`region_id`, `category`, `created_at`),
  CONSTRAINT `fk_posts_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_posts_region_id` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='커뮤니티 글: 커뮤니티의 글 한 개.';

-- 글 좋아요: 누가 어느 글에 좋아요를 눌렀는지. 한 사람이 한 글에 한 번만 누를 수 있어서 (글, 사용자)가 기본키입니다.
CREATE TABLE IF NOT EXISTS `post_likes` (
  `post_id` BIGINT UNSIGNED NOT NULL COMMENT '좋아요 받은 글 아이디',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '좋아요 누른 사용자 아이디 — 한 사람당 한 번',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '좋아요 일시',
  PRIMARY KEY (`post_id`, `user_id`),
  CONSTRAINT `fk_post_likes_post_id` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_post_likes_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='글 좋아요: 누가 어느 글에 좋아요를 눌렀는지.';

-- 댓글: 글에 달린 댓글. 지금 화면은 한 줄 댓글이지만 parent_id 로 대댓글도 만들 수 있게 열어 뒀습니다.
CREATE TABLE IF NOT EXISTS `comments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '댓글 아이디 — 자동 증가',
  `post_id` BIGINT UNSIGNED NOT NULL COMMENT '댓글이 달린 글 아이디',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '댓글 작성자 아이디',
  `parent_id` BIGINT UNSIGNED NULL COMMENT '부모 댓글 아이디 — 대댓글일 때만',
  `body` VARCHAR(200) NOT NULL COMMENT '댓글 내용',
  `status` ENUM('VISIBLE','HIDDEN','DELETED') NOT NULL DEFAULT 'VISIBLE' COMMENT '댓글 상태',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '작성 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '댓글 수정 일시',
  `deleted_at` DATETIME NULL COMMENT '삭제 일시 — 소프트 삭제',
  PRIMARY KEY (`id`),
  KEY `idx_comments_post_id_created_at` (`post_id`, `created_at`),
  CONSTRAINT `fk_comments_post_id` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comments_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comments_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='댓글: 글에 달린 댓글.';

-- 신고: 운영 정책에 어긋나는 글·댓글을 신고한 기록(정책 제3조). 운영자가 확인해 숨김 처리하거나 기각합니다.
CREATE TABLE IF NOT EXISTS `reports` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '신고 아이디 — 자동 증가',
  `reporter_id` BIGINT UNSIGNED NOT NULL COMMENT '신고한 사용자 아이디',
  `target_type` ENUM('POST','COMMENT') NOT NULL COMMENT '신고 대상 종류 — 글 / 댓글',
  `target_id` BIGINT UNSIGNED NOT NULL COMMENT '신고 대상 번호 — 글 또는 댓글 아이디',
  `reason` ENUM('ABUSE','FALSE_INFO','PRIVACY','AD_ILLEGAL','COPYRIGHT','OTHER') NOT NULL COMMENT '신고 사유 — 욕설·허위·개인정보·광고/불법·저작권·기타',
  `detail` VARCHAR(200) NULL COMMENT '자세한 내용',
  `status` ENUM('RECEIVED','HIDDEN','DISMISSED') NOT NULL DEFAULT 'RECEIVED' COMMENT '처리 상태 — 접수 / 숨김 처리 / 기각',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '신고 일시',
  `handled_by` BIGINT UNSIGNED NULL COMMENT '처리한 운영자 아이디',
  `handled_at` DATETIME NULL COMMENT '처리 일시',
  PRIMARY KEY (`id`),
  KEY `idx_reports_target_type_target_id` (`target_type`, `target_id`),
  CONSTRAINT `fk_reports_reporter_id` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reports_handled_by` FOREIGN KEY (`handled_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='신고: 운영 정책에 어긋나는 글·댓글을 신고한 기록(정책 제3조).';

-- 이용 제한: 운영 정책 위반에 따른 조치 기록(정책 제7조: 경고 → 게시 제한 → 이용 제한 → 이용 정지). 기간이 있는 제한은 ends_at 까지 적용됩니다.
CREATE TABLE IF NOT EXISTS `user_sanctions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '조치 아이디 — 자동 증가',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '조치 받은 사용자 아이디',
  `sanction_type` ENUM('WARNING','POST_RESTRICT','SUSPEND','BAN') NOT NULL COMMENT '조치 종류 — 경고 / 게시 제한 / 이용 제한 / 정지',
  `reason` VARCHAR(200) NOT NULL COMMENT '조치 사유',
  `report_id` BIGINT UNSIGNED NULL COMMENT '관련 신고 아이디',
  `starts_at` DATETIME NOT NULL COMMENT '시작 일시',
  `ends_at` DATETIME NULL COMMENT '끝나는 일시 — 비우면 기간 없음(정지)',
  `created_by` BIGINT UNSIGNED NULL COMMENT '조치한 운영자 아이디',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '기록 일시',
  `seen_at` DATETIME NULL COMMENT '사용자가 경고를 확인한 시각',
  `revoked_at` DATETIME NULL COMMENT '관리자가 조치를 해제한 시각',
  `revoked_by` BIGINT UNSIGNED NULL COMMENT '해제한 관리자 번호',
  `revoke_reason` VARCHAR(200) NULL COMMENT '해제 사유',
  CONSTRAINT `fk_user_sanctions_revoked_by` FOREIGN KEY (`revoked_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_user_sanctions_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_sanctions_report_id` FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_user_sanctions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='이용 제한: 운영 정책 위반에 따른 조치 기록(정책 제7조: 경고 → 게시 제한 → 이용 제한 → 이용 정지).';

-- ----------------------------------------------------------------------------
-- 5. AI · 지도 · 공용 데이터
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `banned_identities` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '고유 번호',
  `user_id` BIGINT UNSIGNED NULL COMMENT '대상 회원 — 탈퇴 시 연결만 해제',
  `sanction_id` BIGINT UNSIGNED NULL COMMENT '관련 제재 — 삭제 시 연결만 해제',
  `identity_type` ENUM('LOGIN_ID','NICKNAME','PHONE') NOT NULL COMMENT '재가입 차단 식별값 종류',
  `identity_hash` CHAR(64) NOT NULL COMMENT '정규화한 식별값의 서버 비밀키 기반 HMAC-SHA256 — 원문 저장 금지',
  `hash_key_version` SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'HMAC 키 버전 — 서버에서 키 관리',
  `starts_at` DATETIME NOT NULL COMMENT '차단 시작 일시',
  `expires_at` DATETIME NULL COMMENT '차단 만료 일시 — NULL은 영구',
  `revoked_at` DATETIME NULL COMMENT '차단 해제 일시',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  PRIMARY KEY (`id`),
  KEY `idx_banned_identity_lookup` (`identity_type`, `identity_hash`, `hash_key_version`),
  UNIQUE KEY `uk_banned_sanction_identity` (`sanction_id`, `identity_type`),
  CONSTRAINT `fk_banned_identities_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_banned_identities_sanction_id` FOREIGN KEY (`sanction_id`) REFERENCES `user_sanctions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='탈퇴 후에도 유지하는 재가입 차단 식별값';

CREATE TABLE IF NOT EXISTS `support_inquiries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '고유 번호',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '소유 사용자 번호',
  `category` ENUM('이용 문의','오류 신고','개선 제안','계정 문의','기타') NOT NULL DEFAULT '이용 문의' COMMENT '고객센터 문의 유형',
  `title` VARCHAR(100) NOT NULL COMMENT '문의 제목',
  `content` TEXT NOT NULL COMMENT '문의 내용 — 1~3000자',
  `answer_content` TEXT NULL COMMENT '관리자 답변 — 1~3000자, 문의당 답변 하나',
  `answered_by` BIGINT UNSIGNED NULL COMMENT '답변한 관리자 번호',
  `answered_at` DATETIME NULL COMMENT '답변 일시 — NULL이면 답변 대기',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  PRIMARY KEY (`id`),
  KEY `idx_support_user_created` (`user_id`, `created_at`),
  KEY `idx_support_answered_created` (`answered_at`, `created_at`),
  CONSTRAINT `fk_support_inquiries_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_support_answered_by` FOREIGN KEY (`answered_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='고객센터 문의와 관리자 단일 답변';

-- AI 분야: 자유 질문·사용 방법·근처 탐색 등 10개 주제. 분야를 추가·숨기는 것은 이 표만 고치면 됩니다.
CREATE TABLE IF NOT EXISTS `ai_topics` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '분야 아이디 — 자동 증가',
  `code` VARCHAR(20) NOT NULL COMMENT '분야 코드 — trash, cook, summary 등',
  `name` VARCHAR(30) NOT NULL COMMENT '분야 이름',
  `description` VARCHAR(60) NOT NULL COMMENT '분야 설명 — 카드에 보이는 한 줄',
  `photo_supported` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '사진 첨부 지원 — 사진을 올리면 "추천" 표시',
  `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '정렬 순서',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '사용 여부',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ai_topics_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 분야: AI 화면의 분야 카드와 홈 AI 대화 칩의 목록(자유 질문·근처 탐색·분리배출·냉장고 요리·청소·계약·집주인 문자·공과금·지출 요약).';

-- 업로드 파일: 커뮤니티 첨부파일과 향후 파일 저장 기능의 메타데이터. 파일 자체는 파일 저장소에 두고 여기에는 주소와 정보만 적습니다. 탈퇴·첨부 삭제 시 실제 저장소 파일 삭제는 서버가 별도로 처리합니다. 현재 AI 사진은 처리 후 저장하지 않습니다.
CREATE TABLE IF NOT EXISTS `uploaded_files` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '파일 아이디 — 자동 증가',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '올린 사용자 아이디',
  `original_name` VARCHAR(255) NOT NULL COMMENT '원래 파일 이름',
  `storage_url` VARCHAR(500) NOT NULL COMMENT '저장 주소 — 파일 저장소 주소',
  `mime_type` VARCHAR(50) NOT NULL COMMENT '파일 형식 — 예: image/jpeg',
  `size_bytes` INT UNSIGNED NOT NULL COMMENT '파일 크기 — 바이트',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '업로드 일시',
  `deleted_at` DATETIME NULL COMMENT '삭제 일시',
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_uploaded_files_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='커뮤니티 첨부파일 및 파일 저장 메타데이터';

CREATE TABLE IF NOT EXISTS `user_profiles` (
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '사용자 번호 — 회원당 한 프로필',
  `bio` VARCHAR(30) NOT NULL DEFAULT '' COMMENT '한 줄 소개',
  `avatar_file_id` BIGINT UNSIGNED NULL COMMENT '프로필 사진 파일 번호 — 본인 소유 파일만 허용',
  `avatar_emoji` VARCHAR(20) NULL COMMENT '프로필 캐릭터',
  `avatar_color` VARCHAR(20) NULL COMMENT '프로필 배경 색',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정 일시',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_user_profiles_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_profiles_avatar_file_id` FOREIGN KEY (`avatar_file_id`) REFERENCES `uploaded_files` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='프로필 꾸미기 — 인증 응답에 users와 함께 조회';

-- 게시글 첨부: 시안의 attachments 배열에 대응. 파일 원문은 저장소에 두고 연결과 표시 순서만 저장합니다.
-- 최대 5개·합계 2MB, 파일 소유자 일치, MIME 검증은 서버 트랜잭션에서 검사합니다.
CREATE TABLE IF NOT EXISTS `post_attachments` (
  `post_id` BIGINT UNSIGNED NOT NULL COMMENT '첨부한 게시글 아이디',
  `file_id` BIGINT UNSIGNED NOT NULL COMMENT '업로드 파일 아이디',
  `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '게시글 안의 표시 순서 — 0부터',
  PRIMARY KEY (`post_id`, `file_id`),
  UNIQUE KEY `uk_post_attachments_file_id` (`file_id`),
  UNIQUE KEY `uk_post_attachments_post_sort` (`post_id`, `sort_order`),
  CONSTRAINT `fk_post_attachments_post_id` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_post_attachments_file_id` FOREIGN KEY (`file_id`) REFERENCES `uploaded_files` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='게시글과 첨부파일 연결';

-- AI 대화: AI와의 대화 한 건(대화방). 홈의 "AI와 대화" 모달에서 시작한 대화와 AI 메뉴 화면에서 시작한 대화를 구분하고, "새 대화"를 누르면 새 줄이 생깁니다.
CREATE TABLE IF NOT EXISTS `ai_conversations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '대화 아이디 — 자동 증가',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '대화한 사용자 아이디',
  `topic_id` BIGINT UNSIGNED NULL COMMENT '대화 분야 아이디 — 분야를 고르고 시작했을 때',
  `entry_point` ENUM('HOME_MODAL','AI_PAGE') NOT NULL COMMENT '시작한 곳 — 홈 모달 / AI 화면',
  `title` VARCHAR(100) NULL COMMENT '대화 제목 — 첫 질문 요약',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '대화 시작 일시',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '마지막 대화 일시',
  PRIMARY KEY (`id`),
  KEY `idx_ai_conversations_user_id_updated_at` (`user_id`, `updated_at`),
  CONSTRAINT `fk_ai_conversations_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ai_conversations_topic_id` FOREIGN KEY (`topic_id`) REFERENCES `ai_topics` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 대화: AI와의 대화 한 건(대화방).';

-- AI 메시지: 대화 안의 말풍선 한 개. 사용자가 보낸 말과 AI의 답을 순서대로 쌓습니다. "이번 달 지출 요약"처럼 카드로 보이는 답은 그때의 숫자를 card_data(JSON)에 같이 저장해 다시 열어도 같은 모습으로 보입니다.
CREATE TABLE IF NOT EXISTS `ai_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '메시지 아이디 — 자동 증가',
  `conversation_id` BIGINT UNSIGNED NOT NULL COMMENT '메시지가 속한 대화 아이디',
  `role` ENUM('USER','ASSISTANT') NOT NULL COMMENT '보낸 쪽 — 사용자 / AI',
  `content` TEXT NOT NULL COMMENT '메시지 내용',
  `card_type` ENUM('SPEND_SUMMARY','LINK') NULL COMMENT '카드 종류 — 지출 요약 또는 앱 내부 이동 링크',
  `card_data` JSON NULL COMMENT '카드 내용 — 카드에 보이는 숫자. 예: {month,total,prevTotal,fixed,rows,top}',
  `attachment_id` BIGINT UNSIGNED NULL COMMENT '첨부 파일 아이디 — 사진 첨부(선택)',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '작성 일시',
  PRIMARY KEY (`id`),
  KEY `idx_ai_messages_conversation_id_created_at` (`conversation_id`, `created_at`),
  CONSTRAINT `fk_ai_messages_conversation_id` FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ai_messages_attachment_id` FOREIGN KEY (`attachment_id`) REFERENCES `uploaded_files` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 메시지: 대화 안의 말풍선 한 개.';

-- AI 하루 사용량: 사용자별로 하루에 AI에게 몇 번 질문했는지 세는 표. 실제 AI를 연결할 때 하루 한도를 걸거나 비용을 확인하는 데 씁니다.
CREATE TABLE IF NOT EXISTS `ai_usage_daily` (
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '사용자 아이디',
  `usage_date` DATE NOT NULL COMMENT '사용 날짜',
  `question_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '하루 질문 횟수',
  PRIMARY KEY (`user_id`, `usage_date`),
  CONSTRAINT `fk_ai_usage_daily_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 하루 사용량: 사용자별로 하루에 AI에게 몇 번 질문했는지 세는 표.';

-- 쓰레기 배출 일정: 동네별 요일 배출표. 홈 쓰레기 카드, 쓰레기 화면의 요일표, 오른쪽 패널, 알림이 모두 이 표로 "오늘 무슨 쓰레기를 내놓는지"를 알려줍니다. 배출 없는 요일은 줄이 없습니다.
CREATE TABLE IF NOT EXISTS `trash_schedules` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '배출일정 아이디 — 자동 증가',
  `region_id` BIGINT UNSIGNED NOT NULL COMMENT '동네 아이디',
  `weekday` TINYINT UNSIGNED NOT NULL COMMENT '배출 요일 — 0=일 ~ 6=토',
  `waste_type` ENUM('GENERAL','RECYCLE','FOOD') NOT NULL COMMENT '배출 종류 — 일반쓰레기 / 재활용 / 음식물',
  `description` VARCHAR(100) NOT NULL COMMENT '배출 안내 — 예: 저녁 6시 ~ 자정, 종량제 봉투 사용',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_trash_schedules_region_weekday_type` (`region_id`, `weekday`, `waste_type`),
  CONSTRAINT `fk_trash_schedules_region_id` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='쓰레기 배출 일정: 동네별 요일 배출표.';

-- 장소 분류: 지도 화면의 칩(세탁방·편의점·약국·마트) 목록.
CREATE TABLE IF NOT EXISTS `place_categories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '장소 분류 아이디 — 자동 증가',
  `name` VARCHAR(20) NOT NULL COMMENT '장소 분류 이름 — 세탁방, 편의점 등',
  `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '정렬 순서',
  `icon` VARCHAR(20) NOT NULL DEFAULT '📍' COMMENT '장소 분류 그림',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_place_categories_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='장소 분류: 지도 화면의 칩(세탁방·편의점·약국·마트) 목록.';

-- 주변 장소: 지도 화면과 AI "근처 탐색"에 나오는 가게·시설. 이름·위치뿐 아니라 전화번호·영업시간·평점도 담을 수 있게 열어 뒀고, 공공데이터에서 가져온 장소는 source_id 로 원본과 연결합니다.
CREATE TABLE IF NOT EXISTS `places` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '장소 아이디 — 자동 증가',
  `region_id` BIGINT UNSIGNED NOT NULL COMMENT '장소 동네 아이디',
  `category_id` BIGINT UNSIGNED NOT NULL COMMENT '장소 분류 아이디',
  `name` VARCHAR(60) NOT NULL COMMENT '장소 이름',
  `description` VARCHAR(100) NULL COMMENT '장소 설명 — 예: 도보 약 3분 · 24시간',
  `lat` DECIMAL(9,6) NOT NULL COMMENT '위도',
  `lon` DECIMAL(9,6) NOT NULL COMMENT '경도',
  `address` VARCHAR(200) NULL COMMENT '주소',
  `phone` VARCHAR(20) NULL COMMENT '전화번호',
  `open_hours` VARCHAR(100) NULL COMMENT '영업시간',
  `rating_avg` DECIMAL(2,1) NULL COMMENT '평균 별점 — 리뷰로 계산',
  `review_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '리뷰 수',
  `source` ENUM('MANUAL','PUBLIC_DATA') NOT NULL DEFAULT 'MANUAL' COMMENT '정보 출처 — 직접 입력 / 공공데이터',
  `source_id` VARCHAR(50) NULL COMMENT '원본 데이터 번호 — 공공데이터 원본 ID',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '정보 갱신 일시',
  PRIMARY KEY (`id`),
  KEY `idx_places_region_id_category_id` (`region_id`, `category_id`),
  CONSTRAINT `fk_places_region_id` FOREIGN KEY (`region_id`) REFERENCES `regions` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_places_category_id` FOREIGN KEY (`category_id`) REFERENCES `place_categories` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='주변 장소: 지도 화면과 AI "근처 탐색"에 나오는 가게·시설.';

CREATE TABLE IF NOT EXISTS `place_favorites` (
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '소유 사용자 번호',
  `place_id` BIGINT UNSIGNED NOT NULL COMMENT '저장한 장소 번호',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '등록 일시',
  PRIMARY KEY (`user_id`, `place_id`),
  CONSTRAINT `fk_place_favorites_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_place_favorites_place_id` FOREIGN KEY (`place_id`) REFERENCES `places` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='사용자별 지도 즐겨찾기';

-- 장소 리뷰: 사용자가 장소에 남기는 별점과 한 줄 리뷰(확장 기능). 평균 별점과 리뷰 수는 이 표로 계산해 places 에 채웁니다. 한 사람이 한 장소에 하나만 남깁니다.
CREATE TABLE IF NOT EXISTS `place_reviews` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '리뷰 아이디 — 자동 증가',
  `place_id` BIGINT UNSIGNED NOT NULL COMMENT '리뷰 받은 장소 아이디',
  `user_id` BIGINT UNSIGNED NOT NULL COMMENT '리뷰 쓴 사용자 아이디',
  `rating` TINYINT UNSIGNED NOT NULL COMMENT '별점 — 1~5',
  `body` VARCHAR(300) NULL COMMENT '리뷰 내용',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '작성 일시',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_place_reviews_place_id_user_id` (`place_id`, `user_id`),
  CONSTRAINT `fk_place_reviews_place_id` FOREIGN KEY (`place_id`) REFERENCES `places` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_place_reviews_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='장소 리뷰: 사용자가 장소에 남기는 별점과 한 줄 리뷰(확장 기능).';

-- ----------------------------------------------------------------------------
-- 집계용 VIEW: 홈의 "월별 수입" 그래프, "이번 달 지출 구성" 도넛, AI "이번 달 지출 요약"이 쓰는 계산
-- ----------------------------------------------------------------------------

-- 월별 수입 합계: 홈의 "월별 수입" 막대 그래프와 수입 탭의 월 합계. 사용자·월별로 수입 금액을 더합니다.
CREATE OR REPLACE VIEW `v_monthly_income` AS
SELECT i.user_id, DATE_FORMAT(i.income_date, '%Y-%m') AS period_ym, SUM(i.amount) AS total_amount
FROM incomes i
GROUP BY i.user_id, DATE_FORMAT(i.income_date, '%Y-%m');

-- 월별 지출 구성: 홈의 "이번 달 지출 구성" 도넛과 AI "이번 달 지출 요약". 월세 + 공과금(고정 지출) + 기타 지출을 분류별로 합쳐 한 줄씩 보여줍니다. (월세·공과금 행은 매달 1일에 미납 상태로 미리 만들어 둡니다)
CREATE OR REPLACE VIEW `v_monthly_spend_breakdown` AS
SELECT r.user_id, r.period_ym, '월세' AS label, r.amount AS amount
FROM rent_payments r
UNION ALL
SELECT b.user_id, p.period_ym, '공과금' AS label, SUM(p.amount) AS amount
FROM bill_payments p JOIN bill_items b ON b.id = p.bill_item_id
GROUP BY b.user_id, p.period_ym
UNION ALL
SELECT e.user_id, DATE_FORMAT(e.expense_date, '%Y-%m') AS period_ym, c.name AS label, SUM(e.amount) AS amount
FROM expenses e JOIN ledger_categories c ON c.id = e.category_id
GROUP BY e.user_id, DATE_FORMAT(e.expense_date, '%Y-%m'), c.name;

-- ----------------------------------------------------------------------------
-- 기본 데이터 (프로그램이 처음부터 알고 있어야 하는 값)
-- ----------------------------------------------------------------------------

-- 동네: 시·도 1개 + 구 11개 (id 를 고정해서 아래 주변 동네·쓰레기표가 가리킴)
INSERT IGNORE INTO `regions` (`id`, `parent_id`, `name`, `level`) VALUES
  (1, NULL, '서울특별시', 1),
  (2, 1, '마포구', 2), (3, 1, '서대문구', 2), (4, 1, '용산구', 2), (5, 1, '영등포구', 2), (6, 1, '은평구', 2),
  (7, 1, '종로구', 2), (8, 1, '중구', 2), (9, 1, '성동구', 2), (10, 1, '동작구', 2), (11, 1, '양천구', 2), (12, 1, '강남구', 2);

-- 주변 동네 (커뮤니티의 "주변 동네" 범위)
INSERT IGNORE INTO `region_neighbors` (`region_id`, `neighbor_region_id`) VALUES
  (2, 3), (2, 4), (2, 5),
  (3, 2), (3, 6), (3, 7),
  (4, 2), (4, 8), (4, 9),
  (5, 2), (5, 10), (5, 11);

-- 가계부 분류: 수입 종류 / 기타 지출 분류 (색은 화면의 칩 색과 같음)
INSERT IGNORE INTO `ledger_categories` (`kind`, `name`, `color`, `sort_order`) VALUES
  ('INCOME', '월급', '#1fb5a3', 1), ('INCOME', '아르바이트', '#2f80ed', 2), ('INCOME', '용돈', '#ff5a7e', 3),
  ('INCOME', '부수입', '#f5a623', 4), ('INCOME', '환급·정산', '#7c6cf5', 5), ('INCOME', '기타', '#8a90a2', 6),
  ('EXPENSE', '식비', '#1fb5a3', 1), ('EXPENSE', '생활용품', '#ff5a7e', 2), ('EXPENSE', '교통', '#7c6cf5', 3),
  ('EXPENSE', '건강·의료', '#2f80ed', 4), ('EXPENSE', '문화·여가', '#f5a623', 5), ('EXPENSE', '기타', '#8a90a2', 6);

-- AI 분야 (AI 화면의 카드 / 홈 AI 대화 칩)
INSERT IGNORE INTO `ai_topics` (`code`, `name`, `description`, `photo_supported`, `sort_order`) VALUES
  ('qna', '자유 질문', '자취 관련 궁금한 것', 0, 1),
  ('nearby', '근처 탐색', '세탁방·편의점·약국·마트', 0, 2),
  ('trash', '분리배출', '이건 어떻게 버려요?', 1, 3),
  ('cook', '냉장고 요리', '남은 재료로 한 끼', 1, 4),
  ('clean', '청소·곰팡이', '얼룩, 냄새, 곰팡이', 1, 5),
  ('contract', '계약·보증금', '입주·퇴거 체크리스트', 0, 6),
  ('landlord', '집주인 문자', '정중한 요청 문자 초안', 1, 7),
  ('bill', '공과금·생활비', '아끼는 법, 납부 관리', 0, 8),
  ('summary', '이번 달 지출 요약', '가계부 기록으로 정리', 0, 9);

-- 지도 장소 분류
INSERT IGNORE INTO `place_categories` (`name`, `icon`, `sort_order`) VALUES
  ('세탁방', '🧺', 1),
  ('편의점', '🏪', 2),
  ('약국', '💊', 3),
  ('마트', '🛒', 4),
  ('카페', '☕', 5),
  ('병원', '🏥', 6),
  ('헬스장', '🏋️', 7),
  ('은행', '🏦', 8),
  ('미용실', '💇', 9),
  ('다이소', '🧴', 10),
  ('공원', '🌳', 11),
  ('식당', '🍚', 12),
  ('반찬가게', '🥘', 13),
  ('세탁소', '👔', 14),
  ('주민센터', '🏛️', 15);
UPDATE `place_categories` SET `icon` = '🧺' WHERE `name` = '세탁방';
UPDATE `place_categories` SET `icon` = '🏪' WHERE `name` = '편의점';
UPDATE `place_categories` SET `icon` = '💊' WHERE `name` = '약국';
UPDATE `place_categories` SET `icon` = '🛒' WHERE `name` = '마트';
UPDATE `place_categories` SET `icon` = '☕' WHERE `name` = '카페';
UPDATE `place_categories` SET `icon` = '🏥' WHERE `name` = '병원';
UPDATE `place_categories` SET `icon` = '🏋️' WHERE `name` = '헬스장';
UPDATE `place_categories` SET `icon` = '🏦' WHERE `name` = '은행';
UPDATE `place_categories` SET `icon` = '💇' WHERE `name` = '미용실';
UPDATE `place_categories` SET `icon` = '🧴' WHERE `name` = '다이소';
UPDATE `place_categories` SET `icon` = '🌳' WHERE `name` = '공원';
UPDATE `place_categories` SET `icon` = '🍚' WHERE `name` = '식당';
UPDATE `place_categories` SET `icon` = '🥘' WHERE `name` = '반찬가게';
UPDATE `place_categories` SET `icon` = '👔' WHERE `name` = '세탁소';
UPDATE `place_categories` SET `icon` = '🏛️' WHERE `name` = '주민센터';

-- 쓰레기 배출표 (마포구 예시: 일반쓰레기 월·수·금 ... 요일은 0=일 ~ 6=토, 토요일은 배출 없음)
INSERT IGNORE INTO `trash_schedules` (`region_id`, `weekday`, `waste_type`, `description`) VALUES
  (2, 0, 'GENERAL', '저녁 6시 ~ 자정, 종량제 봉투 사용'),
  (2, 1, 'RECYCLE', '저녁 6시 ~ 자정, 플라스틱 · 캔 · 종이 분리'),
  (2, 2, 'GENERAL', '저녁 6시 ~ 자정, 종량제 봉투 사용'),
  (2, 3, 'RECYCLE', '저녁 6시 ~ 자정, 유리병 · 비닐 분리'),
  (2, 4, 'GENERAL', '저녁 6시 ~ 자정, 종량제 봉투 사용'),
  (2, 5, 'RECYCLE', '저녁 6시 ~ 자정, 플라스틱 · 캔 · 종이 분리');

-- 약관 본문: frontend/src/features/legal/content.ts의 제목·본문·LEGAL_VERSION과 동일
-- 이미 동의한 이전 버전은 보존하며, 본문 변경 시 프론트와 함께 새 버전을 추가합니다.
INSERT IGNORE INTO `terms_documents` (`doc_type`, `version`, `title`, `content`, `consent_kind`, `is_required`, `effective_at`) VALUES
  ('SERVICE', '2026-10-18', 'ZIP 이용약관', '제1조 (목적)
이 약관은 ZIP(이하 "서비스")이 제공하는 자취 생활 관리 서비스의 이용과 관련하여 서비스와 이용자 사이의 권리, 의무 및 책임사항을 정하는 것을 목적으로 합니다.

제2조 (서비스 내용)
서비스는 다음 기능을 제공합니다.
1. 할 일, 일정, 쓰레기 배출 일정 관리
2. 가계부(수입, 고정 지출, 기타 지출) 및 월세·공과금 관리
3. AI 대화 및 생활 꿀팁, 동네 지도 정보, 커뮤니티
서비스의 내용은 운영상 필요에 따라 변경될 수 있으며, 중요한 변경은 사전에 알립니다.

제3조 (회원가입과 계정)
① 만 14세 이상인 이용자는 아이디, 닉네임, 휴대전화 번호, 이메일, 주소를 입력하고 이 약관과 개인정보 수집·이용에 동의하여 가입할 수 있습니다.
② 이용자는 계정 정보를 직접 관리해야 하며, 타인에게 양도하거나 대여할 수 없습니다.
③ 허위 정보를 입력한 경우 서비스 이용이 제한될 수 있습니다.

제4조 (개인정보 보호)
서비스는 이용자의 개인정보를 별도의 「개인정보 처리방침」에 따라 처리하며, 처리방침은 서비스 화면에서 언제든 확인할 수 있습니다.

제5조 (회원 탈퇴)
이용자는 언제든지 마이페이지 > 내 정보에서 회원 탈퇴를 할 수 있으며, 탈퇴하면 계정과 이용 기록은 개인정보 처리방침에 따라 삭제됩니다.

제6조 (게시물)
① 이용자가 커뮤니티에 올린 글과 댓글의 권리와 책임은 작성자에게 있습니다.
② 다른 사람의 개인정보(이름, 연락처, 집 주소 등)가 담긴 게시물은 올릴 수 없으며, 발견 시 서비스가 삭제할 수 있습니다.

제7조 (금지 행위)
다음 행위는 금지되며, 위반 시 게시글 삭제 및 이용 제한이 있을 수 있습니다.
1. 타인의 개인정보 도용 또는 허위 사실 게시
2. 욕설, 비방, 광고성 게시물의 반복 등록
3. 서비스의 정상적인 운영을 방해하는 행위

제8조 (책임의 제한)
서비스는 AI 답변과 지도·가게 정보의 정확성을 보장하지 않으며, 중요한 결정(금융·법률·의료 등)은 반드시 전문가나 공식 자료로 확인해야 합니다.

제9조 (약관의 변경)
약관을 변경하는 경우 시행 7일 전(이용자에게 불리한 변경은 30일 전)에 서비스 내 공지로 알립니다.', 'AGREE', 1, '2026-10-18 00:00:00'),
  ('PRIVACY', '2026-10-18', 'ZIP 개인정보 처리방침', '1. 처리하는 개인정보 항목
· 회원가입(필수): 아이디, 비밀번호, 닉네임, 휴대전화 번호, 이메일, 주소
· 소셜 로그인(필수): 카카오·구글·네이버가 전달하는 식별값, 이메일, 이름(닉네임)
· 서비스 이용 중 이용자가 입력하는 정보: 할 일, 일정, 가계부(수입·지출·월세·공과금) 기록, 커뮤니티 글·댓글, AI 대화 내용, AI에 첨부한 사진
· 자동 수집: 접속 기록, 기기·브라우저 정보, 로그인 유지를 위한 정보(브라우저 저장소)

2. 처리 목적
· 회원 식별, 가입·로그인, 본인 확인(휴대전화 인증), 아이디·비밀번호 찾기, 부정 이용 방지
· 주소: 우리 동네 커뮤니티·지도·쓰레기 배출 정보 제공
· 이용 기록: 일정·가계부·알림 등 서비스 기능 제공
· AI 대화·사진: 질문에 대한 답변 생성
· 문의 응대, 공지 전달, 서비스 개선을 위한 통계(개인을 알아볼 수 없는 형태)

3. 보유 및 이용 기간
· 회원 정보와 이용 기록: 회원 탈퇴 시까지. 탈퇴하면 지체 없이 파기합니다.
· AI에 첨부한 사진: 답변 생성 후 저장하지 않습니다.
· 관련 법령에 따라 보관이 필요한 경우 해당 기간 동안 분리 보관합니다. (예: 「통신비밀보호법」에 따른 접속 기록 3개월)
· 1년 이상 로그인하지 않은 계정은 미리 알린 뒤 분리 보관하거나 파기할 수 있습니다.

4. 제3자 제공
서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 이용자가 미리 동의한 경우나 법령에 특별한 규정이 있는 경우는 예외로 합니다.

5. 처리 위탁 및 국외 이전
서비스 운영을 위해 아래 업무를 외부에 맡길 수 있으며, 실제 업체가 정해지면 이 표를 업데이트하고 알립니다.
· 서버·데이터 보관: [클라우드 업체명, 보관 국가]
· AI 답변 생성(실제 AI 연결 시): [AI 업체명, 이전 국가, 이전 항목(질문 내용·첨부 사진), 이전 시점·방법, 보유 기간]
현재 데모 버전에서는 AI 답변을 서비스 안에서 만들며, 질문·사진을 외부로 보내지 않습니다.

6. 파기 절차 및 방법
보유 기간이 끝나거나 처리 목적을 이룬 개인정보는 지체 없이 파기합니다.
· 전자 파일: 복구할 수 없는 방법으로 삭제
· 종이 문서: 분쇄하거나 소각

7. 이용자의 권리와 행사 방법
이용자는 언제든지 자신의 개인정보를 열람·정정·삭제하거나 처리 정지를 요구할 수 있습니다.
· 열람·정정: 마이페이지 > 내 정보
· 삭제(회원 탈퇴): 마이페이지 > 내 정보 > 회원 탈퇴
· 그 밖의 요청: 아래 개인정보 보호책임자에게 연락
만 14세 미만은 가입할 수 없습니다.

8. 안전성 확보 조치
· 비밀번호 암호화 저장
· 전송 구간 암호화(HTTPS)
· 개인정보 접근 권한 최소화 및 접근 기록 관리

9. 브라우저 저장소(쿠키 등) 사용
서비스는 로그인 유지와 화면 설정을 위해 브라우저 저장소(localStorage·sessionStorage)를 사용합니다.
브라우저 설정에서 저장된 정보를 지울 수 있으며, 지우면 다시 로그인해야 합니다.

10. 개인정보 보호책임자
· 책임자: [이름 / 직책]
· 연락처: [이메일]
개인정보 침해에 대한 신고·상담은 개인정보침해신고센터(국번 없이 118, privacy.kisa.or.kr)에도 할 수 있습니다.

11. 처리방침의 변경
이 처리방침을 변경하면 시행 7일 전(중요한 변경은 30일 전)에 서비스 내 공지로 알립니다.', 'CONFIRM', 1, '2026-10-18 00:00:00'),
  ('POLICY', '2026-10-18', 'ZIP 커뮤니티·AI 운영 정책', '제1조 (목적)
이 정책은 ZIP 커뮤니티와 AI 도우미를 모두가 안전하고 기분 좋게 쓸 수 있도록 지켜야 할 기준과, 지키지 않았을 때의 조치를 정하는 것을 목적으로 합니다.

제2조 (커뮤니티 이용 원칙)
동네 이웃과 생활 정보를 나누는 공간이에요. 서로 존중하며 이용해 주세요.
다음 글과 댓글은 금지되며 운영자가 숨기거나 삭제할 수 있어요.
1. 욕설, 비방, 혐오·차별 표현, 특정인을 향한 공격
2. 허위 사실, 확인되지 않은 소문, 타인의 사생활·개인정보(전화번호, 상세 주소, 얼굴 사진 등) 노출
3. 광고·홍보성 글의 반복 게시, 불법 거래·도박·성인물 관련 글
4. 저작권 등 타인의 권리를 침해하는 내용

제3조 (신고와 게시글 관리)
부적절한 글은 신고할 수 있고, 운영자는 내용을 확인해 숨김·삭제 등을 결정해요.
내 글은 언제든 수정하거나 삭제할 수 있어요. 탈퇴하면 내 글과 기록이 함께 삭제돼요.

제4조 (AI 도우미 이용 안내)
AI 도우미는 분리배출, 요리, 청소, 계약, 생활비 등 자취 생활의 궁금증을 돕는 보조 도구예요.
1. AI의 답변은 부정확하거나 최신이 아닐 수 있어요. 참고용으로만 활용해 주세요.
2. 보증금·계약·세금 등 법률·금융, 건강·의료처럼 중요한 결정은 반드시 전문가나 공식 기관의 안내로 다시 확인해 주세요.
3. 답변에 따라 한 행동의 결과는 이용자 본인에게 있으며, 서비스는 AI 답변의 정확성을 보장하지 않아요.
4. 현재 사진 첨부는 분야 선택을 돕는 용도이며, 사진 속 내용을 직접 분석하지는 않아요.

제5조 (AI 이용 시 주의사항)
비밀번호, 주민등록번호, 계좌·카드 번호 등 민감한 정보는 AI 대화나 사진에 입력·첨부하지 마세요.
타인의 개인정보가 담긴 사진이나 내용은 올리지 마세요.
AI를 이용해 타인을 괴롭히거나 불법적인 목적의 내용을 만드는 행위는 금지돼요.

제6조 (AI 대화 기록)
대화 내용은 이어서 볼 수 있도록 저장되며, 이용자는 "새 대화"나 내 정보의 데이터 초기화, 회원 탈퇴로 삭제할 수 있어요.

제7조 (위반 시 조치)
운영 정책을 위반하면 경고, 게시 제한, 일정 기간 이용 제한, 반복·중대한 경우 이용 정지 순으로 조치할 수 있어요.
조치에 이의가 있으면 문의를 통해 소명할 수 있어요.

제8조 (정책의 변경)
운영 정책을 바꿀 때는 시행 7일 전에 서비스 내 공지로 알려요.', 'AGREE', 1, '2026-10-18 00:00:00');

-- 2026-10-31 추가된 수입 분류 및 AI 사용 방법
INSERT IGNORE INTO `ledger_categories` (`kind`, `name`, `color`, `sort_order`) VALUES
  ('INCOME','이자','#2f80ed',7), ('INCOME','연금','#7c6cf5',8),
  ('INCOME','임대 수입','#f5a623',9), ('INCOME','기타 고정 수입','#8a90a2',10);
INSERT IGNORE INTO `ai_topics` (`code`,`name`,`description`,`photo_supported`,`sort_order`) VALUES
  ('guide','사용 방법','기능이 어디 있는지 알려드려요',0,10);
