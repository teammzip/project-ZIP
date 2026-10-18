/* 수입: 월급·아르바이트·용돈 등 무엇으로 얼마 벌었는지 기록하고 월별로 보기 */
import { $, el, pad, today, fmt, won, ago, monthLabel } from '../core/utils.js';
import { load, store } from '../core/storage.js';
import { registerView } from '../core/router.js';
import { demoIncomes } from '../data/demo.js';

var CATS = [   // [수입 종류, 색]
  ['월급', 'var(--teal)'], ['아르바이트', 'var(--orange)'], ['용돈', 'var(--pink)'],
  ['부수입', '#f5a623'], ['환급·정산', 'var(--purple)'], ['기타', '#8a90a2']
];
var DAYS = ['일', '월', '화', '수', '목', '금', '토'];
function colorOf(cat) { for (var i = 0; i < CATS.length; i++) if (CATS[i][0] === cat) return CATS[i][1]; return '#8a90a2'; }

var incomes = load('zip-incomes', null);
if (!Array.isArray(incomes)) {   // 처음 열 때만 보여줄 예시 기록 (지우거나 새로 기록하면 됨)
  incomes = [
    { id: 1, date: ago(2), cat: '아르바이트', amount: 250000, memo: '주말 카페 알바' },
    { id: 2, date: ago(5), cat: '용돈', amount: 300000, memo: '부모님 용돈' },
    { id: 3, date: ago(8), cat: '부수입', amount: 35000, memo: '중고거래' }
  ];
  store('zip-incomes', incomes);
}
if (!load('zip-demo-income', false)) {   // 둘러보기용: 지난 달들의 수입 예시를 한 번만 더함
  incomes = incomes.concat(demoIncomes());
  store('zip-demo-income', true); store('zip-incomes', incomes);
}
var monthKey = fmt(today).slice(0, 7);   // 지금 보고 있는 달 (YYYY-MM)

function save() { store('zip-incomes', incomes); renderIncome(); }

/* 홈의 "월별 수입" 막대 그래프: 최근 6·12개월의 달별 수입 합계 (기록이 바뀔 때마다 다시 그림) */
function renderIncomeChart() {
  var n = Number($('incRange').value) || 6;
  var sums = {};
  incomes.forEach(function (s) { var k = s.date.slice(0, 7); sums[k] = (sums[k] || 0) + s.amount; });
  var months = [];
  for (var i = n - 1; i >= 0; i--) {
    var d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    var k = d.getFullYear() + '-' + pad(d.getMonth() + 1);
    months.push({ key: k, label: (d.getMonth() + 1) + '월', sum: sums[k] || 0 });
  }
  var max = Math.max.apply(null, months.map(function (m) { return m.sum; }));
  var box = $('incChart');
  box.textContent = '';
  box.classList.toggle('dense', n > 6);
  months.forEach(function (m, idx) {
    var col = el('div', 'col' + (idx === months.length - 1 ? ' hl' : ''));   // 이번 달 강조
    col.appendChild(el('div', 'tip', won(m.sum)));
    var b = el('div', 'b');
    b.style.height = (max ? Math.max(m.sum / max * 88, m.sum ? 4 : 1.5) : 1.5) + '%';
    col.appendChild(b);
    col.appendChild(el('span', null, m.label));
    col.title = m.label + ' 수입 ' + won(m.sum);
    box.appendChild(col);
  });
  var cur = months[months.length - 1].sum, prev = months.length > 1 ? months[months.length - 2].sum : 0;
  var diff = cur - prev;
  $('incSum').textContent = '이번 달 ' + won(cur) + (prev || cur ? ' · 지난달보다 ' + (diff === 0 ? '같아요' : won(Math.abs(diff)) + (diff > 0 ? ' 많아요' : ' 적어요')) : ' · 아직 기록이 없어요');
}
$('incRange').addEventListener('change', renderIncomeChart);

export function renderIncome() {
  renderIncomeChart();
  var keys = {}; keys[fmt(today).slice(0, 7)] = 1;
  incomes.forEach(function (s) { keys[s.date.slice(0, 7)] = 1; });
  var list = Object.keys(keys).sort().reverse();
  if (list.indexOf(monthKey) < 0) monthKey = list[0];
  var sel = $('incomeMonth'); sel.textContent = '';
  list.forEach(function (k) { var o = el('option', null, monthLabel(k)); o.value = k; if (k === monthKey) o.selected = true; sel.appendChild(o); });

  var rows = incomes.filter(function (s) { return s.date.slice(0, 7) === monthKey; })
    .sort(function (a, b) { return b.date.localeCompare(a.date) || b.id - a.id; });
  var total = 0, by = {};
  rows.forEach(function (s) { total += s.amount; by[s.cat] = (by[s.cat] || 0) + s.amount; });
  var topCat = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; })[0];

  $('incomeTitle').textContent = Number(monthKey.split('-')[1]) + '월 수입';
  $('incomeTotal').textContent = won(total);
  $('incomeCount').textContent = rows.length + '건';
  $('incomeTop').textContent = topCat ? topCat + ' ' + Math.round(by[topCat] / total * 100) + '%' : '-';

  var chips = $('incomeCats'); chips.textContent = '';
  CATS.forEach(function (c) {
    if (!by[c[0]]) return;
    var chip = el('span', 'spend-chip');
    chip.style.setProperty('--c', c[1]);
    chip.textContent = c[0] + ' ' + won(by[c[0]]);
    chips.appendChild(chip);
  });

  var box = $('incomeList'); box.textContent = '';
  rows.forEach(function (s) {
    var d = new Date(s.date + 'T00:00:00');
    var row = el('div', 'spend-row');
    var dt = el('div', 'dt'); dt.appendChild(el('b', null, String(d.getDate()))); dt.appendChild(el('small', null, DAYS[d.getDay()]));
    var info = el('div', 'info');
    info.appendChild(el('b', null, s.memo || s.cat));
    var tag = el('span', 'spend-chip small', s.cat); tag.style.setProperty('--c', colorOf(s.cat));
    info.appendChild(tag);
    var amt = el('div', 'amt plus', '+' + won(s.amount));
    var del = el('button', 'del', '×'); del.type = 'button'; del.title = '삭제'; del.setAttribute('aria-label', (s.memo || s.cat) + ' 수입 기록 삭제');
    del.addEventListener('click', function () { incomes = incomes.filter(function (x) { return x.id !== s.id; }); save(); });
    row.appendChild(dt); row.appendChild(info); row.appendChild(amt); row.appendChild(del);
    box.appendChild(row);
  });
  if (!rows.length) box.appendChild(el('div', 'empty', '이 달에는 수입 기록이 없어요. 오른쪽에서 첫 수입을 기록해 보세요.'));
}

CATS.forEach(function (c) { var o = el('option', null, c[0]); o.value = c[0]; $('incomeCat').appendChild(o); });
$('incomeDate').value = fmt(today);
$('incomeMonth').addEventListener('change', function () { monthKey = $('incomeMonth').value; renderIncome(); });
$('incomeForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var date = $('incomeDate').value, amount = Math.round(Number($('incomeAmount').value));
  if (!date || !(amount > 0)) return;
  incomes.push({ id: Date.now(), date: date, cat: $('incomeCat').value, amount: amount, memo: $('incomeMemo').value.trim() });
  monthKey = date.slice(0, 7);   // 기록한 날짜의 달로 이동해서 바로 보이게
  $('incomeAmount').value = ''; $('incomeMemo').value = '';
  save();
});

registerView('income', renderIncome);
