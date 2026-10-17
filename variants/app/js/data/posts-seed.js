/* 커뮤니티 기본 글(시드)과 동네 정보 */
export var HOME = '서울 마포구';
export var NEARBY = {
  '서울 마포구': ['서울 서대문구', '서울 용산구', '서울 영등포구'],
  '서울 서대문구': ['서울 마포구', '서울 은평구', '서울 종로구'],
  '서울 용산구': ['서울 마포구', '서울 중구', '서울 성동구'],
  '서울 영등포구': ['서울 마포구', '서울 동작구', '서울 양천구']
};
var seedNow = Date.now();
export var SEED_POSTS = [
  { id: 1001, region: '서울 마포구', cat: '꿀팁', title: '작은 방을 넓어 보이게 정리하는 법', body: '벽면에 붙이는 작은 거울을 비치하면 시야가 넓어 보여요. 수납장은 가장 자주 쓰는 물건만 남기고, 높은 선반에 보관을 올려 두면 공간이 훨씬 정돈돼 보입니다.', author: '자취8년차', mine: false, ts: seedNow - 3600000 * 5, likes: 12, liked: false, comments: [{ author: '새내기', text: '저도 다음 주에 따라 해볼게요!' }] },
  { id: 1002, region: '서울 마포구', cat: '꿀팁', title: '세제는 이렇게 놓으면 관리가 편해요', body: '설거지용, 청소용, 세탁용을 각각 분리해 칸을 나누고, 세면대 아래에 걸이형 수납을 두면 자주 사용하는 세제와 수건을 한 번에 정리할 수 있어요. 자주 쓰는 건 눈높이에 두면 찾기 편합니다.', author: '청소고수', mine: false, ts: seedNow - 3600000 * 3, likes: 9, liked: false, comments: [{ author: '좋아요', text: '배수구 주변 정리에도 좋겠네요.' }] },
  { id: 1003, region: '서울 마포구', cat: '꿀팁', title: '1인 가구 냉장고 관리 루틴', body: '채소는 물기를 제거한 뒤 채반에 잠깐 두고 보관해주면 숙성 속도가 줄고, 소분한 간식은 자석통이나 눈높이 선반에 두면 꺼내기 편해요. 냉장고 앞쪽에는 자주 먹는 음식만 두면 매번 정리할 필요가 줄어요.', author: '살림꿀팁', mine: false, ts: seedNow - 3600000 * 8, likes: 15, liked: false, comments: [{ author: '후배', text: '냉장고 정리 팁 진짜 좋네요.' }] },
  { id: 1, region: '서울 마포구', cat: '꿀팁', title: '배수구 냄새 잡는 방법', body: '베이킹소다 한 스푼 + 식초 반 컵 부으면 거품 나고, 10분 뒤 뜨거운 물로 헹구면 냄새가 줄어요.', author: '자취8년차', mine: false, ts: seedNow - 3600000 * 5, likes: 12, liked: false, comments: [{ author: '새내기', text: '오 바로 해볼게요!' }] },
  { id: 2, region: '서울 마포구', cat: '질문', title: '근처 세탁방 추천해주세요', body: '이불 빨래할 수 있는 큰 세탁기 있는 곳이면 좋겠어요.', author: '이사온사람', mine: false, ts: seedNow - 3600000 * 2, likes: 3, liked: false, comments: [] },
  { id: 3, region: '서울 마포구', cat: '동네', title: '쓰레기 배출 시간 바뀐 건가요?', body: '어제부터 수거 시간이 달라진 것 같은데 아시는 분 계신가요?', author: '야근러', mine: false, ts: seedNow - 60000 * 20, likes: 7, liked: false, comments: [{ author: '반장님', text: '구청 공지 확인해보니 저녁 6시부터래요.' }] },
  { id: 4, region: '서울 서대문구', cat: '동네', title: '연희동 새벽 시장 열렸어요', body: '주말 아침에 채소랑 과일 싸게 팔아요. 장바구니 꼭 챙기세요.', author: '연희주민', mine: false, ts: seedNow - 3600000 * 8, likes: 9, liked: false, comments: [] },
  { id: 5, region: '서울 용산구', cat: '질문', title: '이태원 쪽 24시 약국 있나요?', body: '밤에 갑자기 열이 나서요. 아시는 분 알려주세요.', author: '밤손님', mine: false, ts: seedNow - 3600000 * 3, likes: 2, liked: false, comments: [{ author: '약사친구', text: '큰길 쪽에 심야 약국 하나 있어요.' }] },
  { id: 6, region: '서울 영등포구', cat: '꿀팁', title: '당산 근처 이사 짐 센터 후기', body: '소형 이사는 용달이 훨씬 싸고, 평일 오전에 예약하면 더 깎아줘요.', author: '이사고수', mine: false, ts: seedNow - 3600000 * 20, likes: 5, liked: false, comments: [] },
  { id: 7, region: '서울 강남구', cat: '자유', title: '역삼 점심 맛집 공유해요', body: '혼밥하기 좋은 곳 위주로 모아봤어요.', author: '직장인', mine: false, ts: seedNow - 3600000 * 30, likes: 4, liked: false, comments: [] }
];
