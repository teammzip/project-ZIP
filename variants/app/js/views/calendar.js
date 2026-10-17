/* 캘린더: 달력, 일정 추가·삭제, 상단 검색, 캘린더 아래 알림 */
import { $, el, pad, fmt, today, todayStr, dayDiff, sortEvents } from '../core/utils.js';
import { store } from '../core/storage.js';
import { state, settings } from '../core/state.js';
import { nextRentDate } from '../core/rentdate.js';
import { TRASH, trashIco } from '../data/trash.js';
import { registerView, showView } from '../core/router.js';
import { updateDot } from './noti.js';

var viewY = today.getFullYear(), viewM = today.getMonth(), selected = todayStr, mode = 'day', query = '';

function renderGrid() {
  $('calTitle').textContent = viewY + '년 ' + (viewM + 1) + '월';
  var grid = $('calGrid');
  grid.textContent = '';
  ['일', '월', '화', '수', '목', '금', '토'].forEach(function (d) { grid.appendChild(el('div', 'cal-dow', d)); });
  var first = new Date(viewY, viewM, 1).getDay();
  var days = new Date(viewY, viewM + 1, 0).getDate();
  for (var i = 0; i < first; i++) grid.appendChild(el('div', 'cal-empty'));
  for (var d = 1; d <= days; d++) {
    var ds = viewY + '-' + pad(viewM + 1) + '-' + pad(d);
    var btn = el('button', 'cal-day');
    btn.type = 'button';
    btn.setAttribute('data-date', ds);
    if (ds === todayStr) btn.classList.add('today');
    if (ds === selected) btn.classList.add('sel');
    btn.appendChild(el('span', null, String(d)));
    var mark = el('span', 'mark');
    var count = state.events.filter(function (ev) { return ev.date === ds; }).length;
    for (var k = 0; k < Math.min(count, 3); k++) mark.appendChild(el('i'));
    btn.appendChild(mark);
    grid.appendChild(btn);
  }
}
$('calGrid').addEventListener('click', function (e) {
  var btn = e.target.closest('.cal-day');
  if (!btn) return;
  selected = btn.getAttribute('data-date');
  $('evDate').value = selected;
  mode = 'day'; query = ''; $('searchInput').value = '';
  renderCalendarAll();
});
$('calPrev').addEventListener('click', function () { viewM--; if (viewM < 0) { viewM = 11; viewY--; } renderGrid(); });
$('calNext').addEventListener('click', function () { viewM++; if (viewM > 11) { viewM = 0; viewY++; } renderGrid(); });
$('calToday').addEventListener('click', function () {
  viewY = today.getFullYear(); viewM = today.getMonth(); selected = todayStr; $('evDate').value = selected; renderCalendarAll();
});

function renderEvList() {
  var list = $('evList');
  list.textContent = '';
  var items = mode === 'day' ? state.events.filter(function (ev) { return ev.date === selected; }) : state.events;
  if (query) {
    var q = query.toLowerCase();
    items = items.filter(function (ev) { return ev.title.toLowerCase().indexOf(q) !== -1; });
  }
  items = sortEvents(items);
  var title = mode === 'day' ? selected.slice(5).replace('-', '월 ') + '일 일정' : '전체 일정';
  if (query) title += ' · 검색: ' + query;
  $('listTitle').textContent = title;
  $('modeDay').classList.toggle('on', mode === 'day');
  $('modeAll').classList.toggle('on', mode === 'all');
  if (!items.length) { list.appendChild(el('li', 'empty', query ? '검색 결과가 없어요.' : '등록된 일정이 없어요.')); return; }
  items.forEach(function (ev) {
    var li = el('li', 'ev');
    li.appendChild(el('span', 'when', (mode === 'all' ? ev.date.slice(5).replace('-', '/') + ' ' : '') + (ev.time || '종일')));
    li.appendChild(el('span', 'name', ev.title));
    var del = el('button', 'del', '×');
    del.type = 'button'; del.title = '삭제';
    del.addEventListener('click', function () {
      state.events = state.events.filter(function (x) { return x.id !== ev.id; });
      store('zip-events', state.events);
      renderCalendarAll(); updateDot();
    });
    li.appendChild(del);
    list.appendChild(li);
  });
}
$('modeDay').addEventListener('click', function () { mode = 'day'; renderEvList(); });
$('modeAll').addEventListener('click', function () { mode = 'all'; renderEvList(); });

function renderCalNoti() {
  var box = $('notiList');
  box.textContent = '';
  var tdc = TRASH[today.getDay()];
  var rows = [tdc
    ? { ico: trashIco(tdc.t), t: tdc.t + ' 배출', s: '오늘 ' + tdc.d, b: '오늘', hot: true }
    : { ico: '🗑️', t: '오늘은 쓰레기 배출 없음', s: '쓰레기는 모아 두세요', b: '오늘', hot: false }];
  var rd = nextRentDate(), rdiff = dayDiff(fmt(rd));
  rows.push({ ico: '💸', t: '월세 납부', s: '매월 ' + settings.rentDay + '일 · ' + settings.rent + '만원', b: rdiff === 0 ? '오늘' : 'D-' + rdiff, hot: rdiff <= 3 });
  sortEvents(state.events).forEach(function (ev) {
    var diff = dayDiff(ev.date);
    if (diff < 0 || diff > 7) return;
    rows.push({ ico: '📌', t: ev.title, s: ev.date.slice(5).replace('-', '월 ') + '일 ' + (ev.time || '종일'), b: diff === 0 ? '오늘' : 'D-' + diff, hot: diff <= 1 });
  });
  rows.forEach(function (r) {
    var n = el('div', 'noti');
    n.appendChild(el('div', 'ico', r.ico));
    var t = el('div', 't');
    t.appendChild(el('b', null, r.t));
    t.appendChild(el('small', null, r.s));
    n.appendChild(t);
    n.appendChild(el('span', 'badge' + (r.hot ? ' hot' : ''), r.b));
    box.appendChild(n);
  });
}
export function renderCalendarAll() { renderGrid(); renderEvList(); renderCalNoti(); }

$('evDate').value = selected;
$('evForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var title = $('evTitle').value.trim(), date = $('evDate').value;
  if (!title || !date) return;
  state.events.push({ id: Date.now(), date: date, time: $('evTime').value, title: title });
  store('zip-events', state.events);
  selected = date; viewY = Number(date.slice(0, 4)); viewM = Number(date.slice(5, 7)) - 1;
  mode = 'day'; query = ''; $('searchInput').value = '';
  $('evTitle').value = ''; $('evTime').value = '';
  renderCalendarAll(); updateDot();
});

/* 상단 검색(일정 제목 검색)과 + 버튼 */
$('searchForm').addEventListener('submit', function (e) {
  e.preventDefault();
  query = $('searchInput').value.trim();
  mode = query ? 'all' : 'day';
  showView('calendar');
});
$('searchInput').addEventListener('input', function () {
  if (!this.value.trim() && query) { query = ''; mode = 'day'; if (!$('view-calendar').hidden) renderEvList(); }
});
$('btnAdd').addEventListener('click', function () { showView('calendar'); $('evTitle').focus(); });

registerView('calendar', renderCalendarAll);
