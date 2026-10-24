/* 쓰레기 배출 요일표 (예시 데이터). 캘린더(정기 일정)와 알림이 이 표를 함께 쓴다. */
export var DOW = ['일', '월', '화', '수', '목', '금', '토'];
// 요일별 배출 종류와 안내 (일요일부터, 배출 없는 요일은 null)
export var TRASH = [
  { t: '일반쓰레기', d: '저녁 6시 ~ 자정, 종량제 봉투 사용' },
  { t: '재활용', d: '저녁 6시 ~ 자정, 플라스틱 · 캔 · 종이 분리' },
  { t: '일반쓰레기', d: '저녁 6시 ~ 자정, 종량제 봉투 사용' },
  { t: '재활용', d: '저녁 6시 ~ 자정, 유리병 · 비닐 분리' },
  { t: '일반쓰레기', d: '저녁 6시 ~ 자정, 종량제 봉투 사용' },
  { t: '재활용', d: '저녁 6시 ~ 자정, 플라스틱 · 캔 · 종이 분리' },
  null
];
// 배출 종류에 맞는 아이콘
export function trashIco(t) { return t === '재활용' ? '♻️' : '🗑️'; }

// 반복되는 요일별 배출 일정을 캘린더에서 실제 날짜의 읽기 전용 일정으로 표시
export function trashEventsBetween(startDate, endDate) {
  var startParts = startDate.split('-');
  var endParts = endDate.split('-');
  var current = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]));
  var end = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]));
  var events = [];
  while (current <= end) {
    var date = current.getFullYear() + '-' + String(current.getMonth() + 1).padStart(2, '0') + '-' + String(current.getDate()).padStart(2, '0');
    var trash = TRASH[current.getDay()];
    if (trash) events.push({
      id: 'trash-' + date,
      date: date,
      time: '18:00',
      title: trash.t + ' 배출',
      detail: trash.d,
      kind: 'trash'
    });
    current.setDate(current.getDate() + 1);
  }
  return events;
}
