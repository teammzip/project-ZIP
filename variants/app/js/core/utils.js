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
