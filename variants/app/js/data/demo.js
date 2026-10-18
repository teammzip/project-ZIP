/* 둘러보기용 예시 기록: 지난 몇 달의 수입·지출과 가까운 날짜의 일정을 "오늘" 기준으로 만들어 준다.
 * 처음 열 때(또는 데이터 초기화 후) 한 번만 기존 기록에 더해지고, 지워도 다시 생기지 않는다. (id 2000번대 이상이 예시) */
import { pad, today } from '../core/utils.js';

function dateOf(monthsAgo, day) {   // N달 전 달의 day일 (YYYY-MM-DD)
  var d = new Date(today.getFullYear(), today.getMonth() - monthsAgo, day);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function dayOffset(n) { var d = new Date(today); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

// 달마다 조금씩 다르게 보이도록 쓰는 값 (1달 전, 2달 전, ... 순서)
var PART_TIME = [265000, 310000, 240000, 295000, 330000, 220000, 285000, 305000, 250000, 320000, 275000];
var EXTRA = [null, ['부수입', 42000, '중고거래'], null, ['환급·정산', 87000, '통신비 환급'], ['부수입', 60000, '번역 알바'], null, ['환급·정산', 35000, '카드 포인트 환급'], null, ['부수입', 50000, '중고거래'], null, ['환급·정산', 120000, '연말정산 환급']];

export function demoIncomes() {
  var list = [], id = 2000;
  for (var m = 1; m <= 11; m++) {
    list.push({ id: id++, date: dateOf(m, 5), cat: '용돈', amount: 300000, memo: '부모님 용돈' });
    list.push({ id: id++, date: dateOf(m, 25), cat: '아르바이트', amount: PART_TIME[m - 1], memo: m % 2 ? '주말 카페 알바' : '주말 카페 알바 (추가 근무 포함)' });
    var x = EXTRA[m - 1];
    if (x) list.push({ id: id++, date: dateOf(m, 14), cat: x[0], amount: x[1], memo: x[2] });
  }
  return list;
}

// [일, 분류, 금액, 메모] — 한 달치 틀. 달마다 금액에 비율을 곱해 변화를 준다.
var MONTH = [
  [2, '식비', 12000, '점심 제육덮밥'], [3, '교통', 3200, '버스'], [4, '식비', 8500, '편의점 도시락'],
  [6, '생활용품', 15800, '세탁세제·섬유유연제'], [8, '식비', 23500, '친구와 저녁'], [9, '문화·여가', 15000, '영화'],
  [11, '식비', 38000, '마트 장보기'], [12, '교통', 4800, '지하철 충전'], [14, '건강·의료', 9000, '감기약'],
  [16, '식비', 6500, '아침 샌드위치'], [18, '생활용품', 11900, '수납박스'], [20, '문화·여가', 22000, '전시회'],
  [22, '식비', 41000, '마트 장보기'], [24, '교통', 12000, '택시'], [26, '식비', 27000, '배달 치킨'],
  [27, '기타', 10000, '경조사비'], [28, '생활용품', 8900, '욕실 청소용품']
];
var SCALE = [1, 0.92, 1.1, 0.97, 1.05, 0.9];

export function demoSpends() {
  var list = [], id = 2000;
  for (var m = 0; m <= 5; m++) {   // 0 = 이번 달 (오늘까지의 날짜만)
    MONTH.forEach(function (r) {
      if (m === 0 && r[0] >= today.getDate()) return;
      list.push({ id: id++, date: dateOf(m, r[0]), cat: r[1], amount: Math.round(r[2] * SCALE[m] / 100) * 100, memo: r[3] });
    });
  }
  return list;
}

export function demoEvents() {   // 오늘 기준 앞뒤 일정
  var rows = [
    [-12, '', '친구 생일 파티'], [-6, '19:00', '동아리 모임'], [-3, '10:00', '치과 진료'],
    [0, '18:00', '장보기 (냉장고 채우기)'],
    [1, '14:00', '집주인 통화'], [2, '', '택배 수령'], [4, '09:00', '보건소 예방접종'],
    [6, '18:30', '친구 저녁 약속'], [9, '', '교통카드 충전'], [13, '11:00', '이사 간 친구 집들이'],
    [18, '', '관리비 정산 확인'], [24, '20:00', '온라인 스터디']
  ];
  return rows.map(function (r, i) { return { id: 3000 + i, date: dayOffset(r[0]), time: r[1], title: r[2] }; });
}
