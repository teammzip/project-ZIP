/* 기타 지출: 식비·생활용품 등을 언제 얼마 썼는지 기록하고 월별로 보기 */
import { $, el, today, fmt, won, ago, monthLabel } from '../core/utils.js';
import { load, store } from '../core/storage.js';
import { state, settings } from '../core/state.js';
import { registerView } from '../core/router.js';
import { demoSpends } from '../data/demo.js';

var CATS = [   // [분류, 색]
  ['식비', 'var(--teal)'], ['생활용품', 'var(--pink)'], ['교통', 'var(--purple)'],
  ['건강·의료', 'var(--orange)'], ['문화·여가', '#f5a623'], ['기타', '#8a90a2']
];
var DAYS = ['일', '월', '화', '수', '목', '금', '토'];
function colorOf(cat) { for (var i = 0; i < CATS.length; i++) if (CATS[i][0] === cat) return CATS[i][1]; return '#8a90a2'; }

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
if (!load('zip-demo-spend', false)) {   // 둘러보기용: 지난 달들의 지출 예시를 한 번만 더함
  spends = spends.concat(demoSpends());
  store('zip-demo-spend', true); store('zip-spends', spends);
}
var monthKey = fmt(today).slice(0, 7);   // 지금 보고 있는 달 (YYYY-MM)

function save() { store('zip-spends', spends); renderSpend(); }

/* 홈의 "이번 달 지출 구성" 도넛: 월세 + 공과금(고정 지출) + 기타 지출 기록을 분류별로 합쳐 비율로 보여 줌.
 * 지난 달은 월세·공과금을 같은 금액으로 보고, 기타 지출은 그 달의 기록을 씀. */
var DONUT_COLORS = {
  '월세': 'var(--purple)', '공과금': 'var(--orange)', '식비': 'var(--teal)', '생활용품': 'var(--pink)',
  '교통': '#5cc8ff', '문화·여가': '#f5a623', '건강·의료': '#e56b6f', '기타': '#8a90a2'
};
/* back달 전(0=이번 달)의 지출을 분류별로 합쳐서 돌려줌: 홈 도넛과 AI의 "지출 요약"이 같이 씀 */
export function spendBreakdown(back) {
  var d = new Date(today.getFullYear(), today.getMonth() - back, 1);
  var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  var sums = {};
  var rent = (Number(settings.rent) || 0) * 10000;
  var bills = state.bills.reduce(function (t, b) { return t + b.amount; }, 0);
  if (rent) sums['월세'] = rent;
  if (bills) sums['공과금'] = bills;
  var variable = 0;
  spends.forEach(function (s) { if (s.date.slice(0, 7) === key) { sums[s.cat] = (sums[s.cat] || 0) + s.amount; variable += s.amount; } });
  var rows = Object.keys(sums).map(function (k) { return [k, sums[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
  var total = rows.reduce(function (t, r) { return t + r[1]; }, 0);
  return { month: d.getMonth() + 1, rows: rows, total: total, fixed: rent + bills, variable: variable };
}

export function renderSpendChart() {
  var back = Number($('spendRange').value) || 0;
  var rows = spendBreakdown(back).rows;
  if (rows.length > 5) {   // 많으면 상위 4개 + 나머지는 "기타 외"로 묶음
    var rest = rows.slice(4).reduce(function (t, r) { return t + r[1]; }, 0);
    rows = rows.slice(0, 4); rows.push(['그 외', rest]);
  }
  var total = rows.reduce(function (t, r) { return t + r[1]; }, 0);
  var stops = [], at = 0, legend = $('spendLegend');
  legend.textContent = '';
  rows.forEach(function (r) {
    var c = DONUT_COLORS[r[0]] || '#8a90a2', from = at;
    at += r[1] / total * 100;
    stops.push(c + ' ' + from + '% ' + at + '%');
    var li = el('li', null, r[0] + ' ');
    li.style.setProperty('--c', c);
    li.appendChild(el('span', null, Math.round(r[1] / total * 100) + '% · ' + (r[1] >= 10000 ? (Math.round(r[1] / 1000) / 10) + '만원' : won(r[1]))));
    legend.appendChild(li);
  });
  $('spendDonut').style.background = total ? 'conic-gradient(' + stops.join(', ') + ')' : '#eceef4';
  $('spendDonutTotal').textContent = total >= 10000 ? (Math.round(total / 1000) / 10) + '만원' : won(total);
  $('spendDonut').setAttribute('aria-label', (back ? '지난 달' : '이번 달') + ' 지출 합계 ' + won(total));
}
$('spendRange').addEventListener('change', renderSpendChart);

export function renderSpend() {
  renderSpendChart();
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
