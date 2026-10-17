/* 기타 지출: 식비·생활용품 등을 언제 얼마 썼는지 기록하고 월별로 보기 */
import { $, el, today, fmt } from '../core/utils.js';
import { load, store } from '../core/storage.js';
import { registerView } from '../core/router.js';

var CATS = [   // [분류, 색]
  ['식비', 'var(--teal)'], ['생활용품', 'var(--pink)'], ['교통', 'var(--purple)'],
  ['건강·의료', 'var(--orange)'], ['문화·여가', '#f5a623'], ['기타', '#8a90a2']
];
var DAYS = ['일', '월', '화', '수', '목', '금', '토'];
function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }
function colorOf(cat) { for (var i = 0; i < CATS.length; i++) if (CATS[i][0] === cat) return CATS[i][1]; return '#8a90a2'; }
function ago(n) { var d = new Date(today); d.setDate(d.getDate() - n); return fmt(d); }

var spends = load('zip-spends', null);
if (!Array.isArray(spends)) {   // 처음 열 때만 보여줄 예시 기록 (지우거나 새로 기록하면 됨)
  spends = [
    { id: 1, date: ago(0), cat: '식비', amount: 6500, memo: '아침 샌드위치' },
    { id: 2, date: ago(1), cat: '생활용품', amount: 12900, memo: '세탁세제' },
    { id: 3, date: ago(2), cat: '식비', amount: 11000, memo: '점심 제육덮밥' },
    { id: 4, date: ago(4), cat: '교통', amount: 3200, memo: '버스' },
    { id: 5, date: ago(5), cat: '문화·여가', amount: 15000, memo: '영화' }
  ];
  store('zip-spends', spends);
}
var monthKey = fmt(today).slice(0, 7);   // 지금 보고 있는 달 (YYYY-MM)

function save() { store('zip-spends', spends); renderSpend(); }
function monthLabel(k) { var p = k.split('-'); return p[0] + '년 ' + Number(p[1]) + '월' + (k === fmt(today).slice(0, 7) ? ' (이번 달)' : ''); }

export function renderSpend() {
  // 월 선택: 기록이 있는 달 + 이번 달
  var keys = {}; keys[fmt(today).slice(0, 7)] = 1;
  spends.forEach(function (s) { keys[s.date.slice(0, 7)] = 1; });
  var list = Object.keys(keys).sort().reverse();
  if (list.indexOf(monthKey) < 0) monthKey = list[0];
  var sel = $('spendMonth'); sel.textContent = '';
  list.forEach(function (k) { var o = el('option', null, monthLabel(k)); o.value = k; if (k === monthKey) o.selected = true; sel.appendChild(o); });

  var rows = spends.filter(function (s) { return s.date.slice(0, 7) === monthKey; })
    .sort(function (a, b) { return b.date.localeCompare(a.date) || b.id - a.id; });
  var total = 0, by = {};
  rows.forEach(function (s) { total += s.amount; by[s.cat] = (by[s.cat] || 0) + s.amount; });
  var topCat = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; })[0];

  $('spendTitle').textContent = Number(monthKey.split('-')[1]) + '월 기타 지출';
  $('spendTotal').textContent = won(total);
  $('spendCount').textContent = rows.length + '건';
  $('spendTop').textContent = topCat ? topCat + ' ' + Math.round(by[topCat] / total * 100) + '%' : '-';

  var chips = $('spendCats'); chips.textContent = '';
  CATS.forEach(function (c) {
    if (!by[c[0]]) return;
    var chip = el('span', 'spend-chip');
    chip.style.setProperty('--c', c[1]);
    chip.textContent = c[0] + ' ' + won(by[c[0]]);
    chips.appendChild(chip);
  });

  var box = $('spendList'); box.textContent = '';
  rows.forEach(function (s) {
    var d = new Date(s.date + 'T00:00:00');
    var row = el('div', 'spend-row');
    var dt = el('div', 'dt'); dt.appendChild(el('b', null, String(d.getDate()))); dt.appendChild(el('small', null, DAYS[d.getDay()]));
    var info = el('div', 'info');
    info.appendChild(el('b', null, s.memo || s.cat));
    var tag = el('span', 'spend-chip small', s.cat); tag.style.setProperty('--c', colorOf(s.cat));
    info.appendChild(tag);
    var amt = el('div', 'amt', won(s.amount));
    var del = el('button', 'del', '×'); del.type = 'button'; del.title = '삭제'; del.setAttribute('aria-label', (s.memo || s.cat) + ' 기록 삭제');
    del.addEventListener('click', function () { spends = spends.filter(function (x) { return x.id !== s.id; }); save(); });
    row.appendChild(dt); row.appendChild(info); row.appendChild(amt); row.appendChild(del);
    box.appendChild(row);
  });
  if (!rows.length) box.appendChild(el('div', 'empty', '이 달에는 기록이 없어요. 오른쪽에서 첫 지출을 기록해 보세요.'));
}

CATS.forEach(function (c) { var o = el('option', null, c[0]); o.value = c[0]; $('spendCat').appendChild(o); });
$('spendDate').value = fmt(today);
$('spendMonth').addEventListener('change', function () { monthKey = $('spendMonth').value; renderSpend(); });
$('spendForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var date = $('spendDate').value, amount = Math.round(Number($('spendAmount').value));
  if (!date || !(amount > 0)) return;
  spends.push({ id: Date.now(), date: date, cat: $('spendCat').value, amount: amount, memo: $('spendMemo').value.trim() });
  monthKey = date.slice(0, 7);   // 기록한 날짜의 달로 이동해서 바로 보이게
  $('spendAmount').value = ''; $('spendMemo').value = '';
  save();
});

registerView('spend', renderSpend);
