-- 개발용 지도 예시 장소 (프론트 frontend/src/features/map/data/places.ts 와 같은 31곳, 서울 마포구)
-- 로컬 테스트 DB 에만 적용하세요. 실제 장소 데이터(공공데이터 · 지도 검색 API)가 정해지면 대체합니다.
-- 다시 실행해도 같은 장소가 두 번 들어가지 않아요 (같은 동네 · 종류 · 이름이면 건너뜀).
USE `zip`;

INSERT INTO `places` (`region_id`, `category_id`, `name`, `description`, `lat`, `lon`, `open_hours`, `source`)
SELECT r.id, c.id, v.name, v.description, v.lat, v.lon, v.open_hours, 'MANUAL'
FROM (
  SELECT '세탁방', '세탁방 A (예시)', '도보 약 3분 · 대형 세탁기', 37.5589, 126.9262, NULL
  UNION ALL
  SELECT '세탁방', '세탁방 B (예시)', '도보 약 6분 · 24시간', 37.5561, 126.9231, '24시간'
  UNION ALL
  SELECT '세탁방', '세탁방 C (예시)', '도보 약 9분 · 건조기', 37.5578, 126.9208, NULL
  UNION ALL
  SELECT '편의점', '편의점 A (예시)', '도보 약 1분 · 24시간', 37.5565, 126.924, '24시간'
  UNION ALL
  SELECT '편의점', '편의점 B (예시)', '도보 약 4분', 37.558, 126.9255, NULL
  UNION ALL
  SELECT '편의점', '편의점 C (예시)', '도보 약 7분 · 24시간', 37.557, 126.9217, '24시간'
  UNION ALL
  SELECT '약국', '약국 A (예시)', '도보 약 5분 · 평일 9~21시', 37.5574, 126.9268, '평일 9~21시'
  UNION ALL
  SELECT '약국', '약국 B (예시)', '도보 약 8분 · 심야 운영', 37.5553, 126.925, NULL
  UNION ALL
  SELECT '마트', '마트 A (예시)', '도보 약 10분 · 식자재', 37.5594, 126.9225, NULL
  UNION ALL
  SELECT '마트', '마트 B (예시)', '도보 약 12분 · 생활용품', 37.5548, 126.9214, NULL
  UNION ALL
  SELECT '카페', '카페 A (예시)', '도보 약 2분 · 조용한 · 콘센트 많음', 37.5571, 126.9249, NULL
  UNION ALL
  SELECT '카페', '카페 B (예시)', '도보 약 5분 · 24시간 · 스터디', 37.5584, 126.9236, '24시간'
  UNION ALL
  SELECT '카페', '카페 C (예시)', '도보 약 8분 · 테이크아웃 전문 · 저렴', 37.5559, 126.9222, NULL
  UNION ALL
  SELECT '병원', '내과 의원 (예시)', '도보 약 6분 · 평일 9~18시 · 내과', 37.5586, 126.9271, '평일 9~18시'
  UNION ALL
  SELECT '병원', '치과 (예시)', '도보 약 7분 · 토요일 진료 · 치과', 37.5567, 126.9275, NULL
  UNION ALL
  SELECT '병원', '야간 진료 의원 (예시)', '도보 약 11분 · 야간 진료 · 소아과', 37.5546, 126.9239, NULL
  UNION ALL
  SELECT '헬스장', '헬스장 A (예시)', '도보 약 4분 · 24시간 · 월 3만원대 · 저렴', 37.5576, 126.9244, '24시간'
  UNION ALL
  SELECT '헬스장', '요가원 (예시)', '도보 약 9분 · 소규모 수업 · 조용한', 37.5592, 126.9253, NULL
  UNION ALL
  SELECT '은행', '은행 지점 (예시)', '도보 약 6분 · 평일 9~16시', 37.5581, 126.9229, '평일 9~16시'
  UNION ALL
  SELECT '은행', 'ATM 코너 (예시)', '도보 약 2분 · 24시간 · 출금', 37.5568, 126.9246, '24시간'
  UNION ALL
  SELECT '미용실', '미용실 A (예시)', '도보 약 5분 · 커트 저렴', 37.5573, 126.9259, NULL
  UNION ALL
  SELECT '미용실', '미용실 B (예시)', '도보 약 10분 · 예약제', 37.5596, 126.9241, NULL
  UNION ALL
  SELECT '다이소', '생활용품점 (예시)', '도보 약 8분 · 생활용품 · 저렴', 37.5557, 126.9262, NULL
  UNION ALL
  SELECT '공원', '동네 공원 (예시)', '도보 약 7분 · 산책 · 조깅 · 조용한', 37.5598, 126.9267, NULL
  UNION ALL
  SELECT '공원', '소공원 (예시)', '도보 약 3분 · 벤치 · 조용한', 37.5563, 126.9256, NULL
  UNION ALL
  SELECT '식당', '분식집 (예시)', '도보 약 3분 · 혼밥 · 저렴', 37.5577, 126.9234, NULL
  UNION ALL
  SELECT '식당', '백반집 (예시)', '도보 약 6분 · 혼밥 · 점심 한식', 37.559, 126.9218, NULL
  UNION ALL
  SELECT '식당', '국밥집 (예시)', '도보 약 9분 · 24시간 · 혼밥', 37.5551, 126.9227, '24시간'
  UNION ALL
  SELECT '반찬가게', '반찬가게 (예시)', '도보 약 5분 · 1인분 소포장', 37.5583, 126.9247, NULL
  UNION ALL
  SELECT '세탁소', '수선·세탁소 (예시)', '도보 약 4분 · 수선 · 드라이클리닝', 37.5569, 126.9263, NULL
  UNION ALL
  SELECT '주민센터', '주민센터 (예시)', '도보 약 10분 · 전입신고 · 평일 9~18시', 37.5595, 126.9232, '평일 9~18시'
) AS v (cat, name, description, lat, lon, open_hours)
JOIN `regions` r ON r.name = '마포구' AND r.level = 2
JOIN `place_categories` c ON c.name = v.cat
WHERE NOT EXISTS (SELECT 1 FROM `places` p WHERE p.region_id = r.id AND p.category_id = c.id AND p.name = v.name);
