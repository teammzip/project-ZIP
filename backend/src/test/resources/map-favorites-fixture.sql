-- 지도 즐겨찾기 테스트용 표 (auth-fixture.sql 다음에 실행). MySQL 표 db/schema.sql 의 필요한 칸만
CREATE TABLE place_categories (id BIGINT PRIMARY KEY, name VARCHAR(20) NOT NULL, icon VARCHAR(10), sort_order INT NOT NULL);
INSERT INTO place_categories (id, name, icon, sort_order) VALUES (1, '편의점', 'x', 1), (2, '다이소', 'x', 2), (99, '기타', 'x', 99);
CREATE TABLE places (id BIGINT PRIMARY KEY, region_id BIGINT NOT NULL, category_id BIGINT NOT NULL, name VARCHAR(60) NOT NULL,
    description VARCHAR(100), lat DECIMAL(9,6) NOT NULL, lon DECIMAL(9,6) NOT NULL, address VARCHAR(200), phone VARCHAR(20),
    open_hours VARCHAR(100), rating_avg DECIMAL(2,1), review_count INT DEFAULT 0 NOT NULL);
INSERT INTO places (id, region_id, category_id, name, lat, lon) VALUES (10, 2, 1, '편의점 A (예시)', 37.55, 126.92);
CREATE TABLE place_favorites (user_id BIGINT NOT NULL, place_id BIGINT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (user_id, place_id));
CREATE TABLE kakao_place_favorites (user_id BIGINT NOT NULL, kakao_place_id VARCHAR(50) NOT NULL, name VARCHAR(60) NOT NULL,
    category VARCHAR(20) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL, PRIMARY KEY (user_id, kakao_place_id));
CREATE TABLE place_lists (id BIGINT AUTO_INCREMENT PRIMARY KEY, user_id BIGINT NOT NULL, name VARCHAR(20) NOT NULL, color CHAR(7) NOT NULL,
    sort_order INT DEFAULT 0 NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL, UNIQUE (user_id, name));
CREATE TABLE place_list_items (list_id BIGINT NOT NULL, place_key VARCHAR(60) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (list_id, place_key), FOREIGN KEY (list_id) REFERENCES place_lists (id) ON DELETE CASCADE);
