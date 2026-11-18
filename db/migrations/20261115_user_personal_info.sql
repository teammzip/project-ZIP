-- 연결된 DB에서 실행. 이름은 기존 users.nickname, 생년월일은 개인 정보로 별도 저장한다.
-- 기존 주거 설문은 보존하며 개인 정보 행이 없는 회원만 조회 시 설문 생년월일을 참고한다.
CREATE TABLE IF NOT EXISTS `user_personal_info` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `birth_date` DATE NULL,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_user_personal_info_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='회원 개인 정보: 주거 계약과 분리';
