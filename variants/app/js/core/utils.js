/* 모든 화면이 쓰는 작은 함수들 */
export var pad = function (n) { return String(n).padStart(2, '0'); };
export var fmt = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
export var $ = function (id) { return document.getElementById(id); };
export function el(tag, cls, text) {
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

export var today = new Date();
export var todayStr = fmt(today);
export function dayDiff(dateStr) { return Math.round((new Date(dateStr) - new Date(todayStr)) / 86400000); }

export function sortEvents(list) {
  return list.slice().sort(function (a, b) { return (a.date + (a.time || '99:99')).localeCompare(b.date + (b.time || '99:99')); });
}

/* 금액·날짜 표시 (가계부 화면들이 같이 씀) */
export function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }
export function ago(n) { var d = new Date(today); d.setDate(d.getDate() - n); return fmt(d); }   // n일 전 날짜 (YYYY-MM-DD)
export function monthLabel(k) { var p = k.split('-'); return p[0] + '년 ' + Number(p[1]) + '월' + (k === fmt(today).slice(0, 7) ? ' (이번 달)' : ''); }
