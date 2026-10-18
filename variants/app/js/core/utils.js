/* 모든 화면이 쓰는 작은 함수들 */
export var pad = function (n) { return String(n).padStart(2, '0'); };
// 날짜를 "YYYY-MM-DD" 글자로
export var fmt = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
// id 로 요소 찾기
export var $ = function (id) { return document.getElementById(id); };
// 요소 만들기: 태그, 클래스, 글자(innerHTML 을 쓰지 않으려고 textContent 로 넣음)
export function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

// 오늘 날짜와 "YYYY-MM-DD" 글자
export var today = new Date();
export var todayStr = fmt(today);
// 오늘부터 그 날짜까지 며칠 남았는지 (지났으면 음수)
export function dayDiff(dateStr) { return Math.round((new Date(dateStr) - new Date(todayStr)) / 86400000); }

// 일정을 날짜·시간 순으로 정렬한 새 배열 (시간이 없으면 하루 맨 뒤)
export function sortEvents(list) {
  return list.slice().sort(function (a, b) { return (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')); });
}

/* 금액·날짜 표시 (가계부 화면들이 같이 씀) */
export function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }
export function ago(n) { var d = new Date(today); d.setDate(d.getDate() - n); return fmt(d); }   // n일 전 날짜 (YYYY-MM-DD)
export function monthLabel(k) { var p = k.split('-'); return p[0] + '년 ' + Number(p[1]) + '월' + (k === fmt(today).slice(0, 7) ? ' (이번 달)' : ''); }
