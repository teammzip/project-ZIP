/* 캘린더: 달력, 일정 추가(카테고리 항목 버튼 + 날짜 누르기 / 직접 입력)·수정·삭제, 상단 검색, 캘린더 아래 알림 */
import { $, el, pad, fmt, today, todayStr, dayDiff, sortEvents } from '../core/utils.js';
import { store } from '../core/storage.js';
import { state, settings } from '../core/state.js';
import { nextRentDate } from '../core/rentdate.js';
import { trashIco, trashEventsBetween } from '../data/trash.js';
import { EV_PRESETS } from '../data/ev-presets.js';
import { registerView, showView } from '../core/router.js';
import { updateDot } from './noti.js';

// 달력이 보여주는 연·월, 선택한 날, 목록 보기 방식, 검색어, 수정 중인 일정 번호
var viewY = today.getFullYear(), viewM = today.getMonth(), selected = todayStr, mode = 'today', query = '', editingId = null;
// 일정 기록하기에서 눌러 둔 카테고리 항목 이름 (없으면 null). 달력에서 날짜를 누르면 이 이름으로 일정이 추가됨
var pick = null;

function weekRange(date) {
  var start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  var end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: fmt(start), end: fmt(end) };
}

function eventsForWeek() {
  var range = weekRange(today);
  var events = state.events.filter(function (ev) { return ev.date >= range.start && ev.date <= range.end; });
  return events.concat(trashEventsBetween(range.start, range.end));
}

function trashEventsForMonth() {
  var start = viewY + '-' + pad(viewM + 1) + '-01';
  var end = viewY + '-' + pad(viewM + 1) + '-' + pad(new Date(viewY, viewM + 1, 0).getDate());
  return trashEventsBetween(start, end);
}

function eventsForSelectedDay() {
  return state.events.filter(function (ev) { return ev.date === selected; })
    .concat(trashEventsBetween(selected, selected));
}

function eventsForToday() {
  return state.events.filter(function (ev) { return ev.date === todayStr; })
    .concat(trashEventsBetween(todayStr, todayStr));
}

function renderEventSummary() {
  var pending = state.events.filter(function (ev) { return !ev.done; });
  var allToday = state.events.filter(function (ev) { return ev.date === todayStr; });
  var todayPending = allToday.filter(function (ev) { return !ev.done; });
  var doneCount = state.events.length - pending.length;
  var todayDone = allToday.length - todayPending.length;
  var pct = state.events.length ? Math.round(doneCount / state.events.length * 100) : 0;
  var summary = todayPending.length
    ? todayPending.slice(0, 2).map(function (ev) { return ev.title; }).join(' · ')
    : allToday.length ? '오늘 할 일을 모두 완료했어요!' : '오늘 등록된 할 일이 없어요.';
  if (todayPending.length > 2) summary += ' 외 ' + (todayPending.length - 2) + '개';
  $('eventLeft').textContent = pending.length;
  $('eventBar').style.width = pct + '%';
  $('eventSub').textContent = state.events.length
    ? '전체 ' + state.events.length + '개 중 ' + doneCount + '개 완료'
    : '일정을 추가해 보세요.';
  $('todayTodoLeft').textContent = todayPending.length;
  $('todayTodoBar').style.width = allToday.length ? Math.round(todayDone / allToday.length * 100) + '%' : '0%';
  $('todayTodoSub').textContent = summary;
  $('todayTodoSub').title = summary;
  $('todayTodoSub').parentElement.setAttribute('aria-label', '오늘 할 일 ' + todayPending.length + '개. ' + summary);
}

// 달력 칸을 그림: 오늘·선택한 날 표시, 일정이 있는 날은 점(최대 3개)
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
    var count = state.events.filter(function (ev) { return ev.date === ds; }).length
      + trashEventsBetween(ds, ds).length;
    for (var k = 0; k < Math.min(count, 3); k++) mark.appendChild(el('i'));
    btn.appendChild(mark);
    grid.appendChild(btn);
  }
}
// 날짜를 누르면 그 날을 선택하고 일정 목록을 그 날로 바꿈
$('calGrid').addEventListener('click', function (e) {
  var btn = e.target.closest('.cal-day');
  if (!btn) return;
  var ds = btn.getAttribute('data-date');
  if (pick) { addPicked(ds); return; }   // 항목을 골라 둔 상태면 이 날짜에 추가
  selected = ds;
  $('evDate').value = selected;
  editingId = null; mode = 'day'; query = ''; $('searchInput').value = '';
  renderCalendarAll();
});
// 이전 달 / 다음 달 / 오늘 버튼
$('calPrev').addEventListener('click', function () { viewM--; if (viewM < 0) { viewM = 11; viewY--; } renderGrid(); });
$('calNext').addEventListener('click', function () { viewM++; if (viewM > 11) { viewM = 0; viewY++; } renderGrid(); });
$('calToday').addEventListener('click', function () {
  viewY = today.getFullYear(); viewM = today.getMonth(); selected = todayStr; $('evDate').value = selected; renderCalendarAll();
});

// 일정 목록: 선택한 날 또는 전체, 검색어가 있으면 제목으로 거름. 줄마다 수정·삭제 버튼
function renderEvList() {
  var list = $('evList');
  list.textContent = '';
  var items = mode === 'today' ? eventsForToday()
    : mode === 'week' ? eventsForWeek()
      : mode === 'day' ? eventsForSelectedDay()
        : state.events.concat(trashEventsForMonth());
  if (query) {
    var q = query.toLowerCase();
    items = items.filter(function (ev) { return ev.title.toLowerCase().indexOf(q) !== -1; });
  }
  items = sortEvents(items);
  var title = mode === 'today' ? '오늘 할 일'
    : mode === 'week' ? '이번 주 할 일'
      : mode === 'day' ? selected.slice(5).replace('-', '월 ') + '일 일정' : '전체 일정';
  if (query) title += ' · 검색: ' + query;
  $('listTitle').textContent = title;
  $('modeToday').classList.toggle('on', mode === 'today');
  $('modeWeek').classList.toggle('on', mode === 'week');
  $('modeDay').classList.toggle('on', mode === 'day');
  $('modeAll').classList.toggle('on', mode === 'all');
  if (!items.length) { list.appendChild(el('li', 'empty', query ? '검색 결과가 없어요.' : '등록된 일정이 없어요.')); return; }
  items.forEach(function (ev) {
    if (ev.kind === 'trash') {
      var trashRow = el('li', 'ev trash-event');
      trashRow.appendChild(el('span', 'when', ev.time));
      var trashName = el('span', 'name', ev.title);
      trashName.title = ev.detail;
      trashRow.appendChild(trashName);
      trashRow.appendChild(el('small', 'trash-detail', ev.detail));
      list.appendChild(trashRow);
      return;
    }
    if (ev.id === editingId) { list.appendChild(editRow(ev)); return; }
    var li = el('li', 'ev' + (ev.done ? ' completed' : ''));
    var cb = el('input', 'ev-check');
    cb.type = 'checkbox';
    cb.checked = !!ev.done;
    cb.setAttribute('aria-label', ev.title + ' 완료');
    cb.addEventListener('change', function () {
      ev.done = cb.checked;
      store('zip-events', state.events);
      renderCalendarAll();
      updateDot();
    });
    li.appendChild(cb);
    li.appendChild(el('span', 'when', (mode === 'all' || mode === 'week' ? ev.date.slice(5).replace('-', '/') + ' ' : '') + (ev.time || '종일')));
    li.appendChild(el('span', 'name', ev.title));
    var edit = el('button', 'edit', '수정');
    edit.type = 'button'; edit.title = '일정 수정';
    edit.addEventListener('click', function () { editingId = ev.id; renderEvList(); });
    li.appendChild(edit);
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
function setMode(nextMode) {
  editingId = null;
  mode = nextMode;
  if (nextMode === 'today' || nextMode === 'week') {
    selected = todayStr;
    viewY = today.getFullYear();
    viewM = today.getMonth();
    $('evDate').value = todayStr;
  }
  renderCalendarAll();
}

// 홈 일정 카드는 해당 날짜 범위를 바로 열어 표시
$('allEventsCard').addEventListener('click', function (e) {
  e.stopImmediatePropagation();
  setMode('all');
  showView('calendar');
});
$('todayTasksCard').addEventListener('click', function (e) {
  e.stopImmediatePropagation();
  setMode('today');
  showView('calendar');
});

// 오늘·이번 주·선택 날짜·전체 일정 필터
$('modeToday').addEventListener('click', function () { setMode('today'); });
$('modeWeek').addEventListener('click', function () { setMode('week'); });
$('modeDay').addEventListener('click', function () { setMode('day'); });
$('modeAll').addEventListener('click', function () { setMode('all'); });

/* 일정 기록하기 ① 카테고리 항목 버튼 → ② 달력에서 날짜 누르기(또는 오늘·이번 주 버튼)로 추가 */
function renderPresets() {
  var box = $('evCats'); box.textContent = '';
  EV_PRESETS.forEach(function (cat) {
    var g = el('div', 'ev-cat');
    g.appendChild(el('h3', null, cat.ico + ' ' + cat.name));
    var row = el('div', 'chips');
    cat.items.forEach(function (name) {
      var b = el('button', 'chip' + (pick === name ? ' on' : ''), name);
      b.type = 'button';
      b.addEventListener('click', function () { setPick(pick === name ? null : name); });
      row.appendChild(b);
    });
    g.appendChild(row);
    box.appendChild(g);
  });
}
// 항목을 고르거나(이름) 해제(null)하고 안내 줄을 맞춤
function setPick(name) {
  pick = name;
  $('pickBar').hidden = !pick;
  if (pick) { $('pickName').textContent = '「' + pick + '」'; $('pickNote').textContent = '달력에서 날짜를 눌러 주세요.'; }
  renderPresets();
}
// 골라 둔 항목을 이 날짜에 일정으로 추가 (같은 날 같은 이름이 이미 있으면 건너뜀)
function addPicked(date) {
  var dup = state.events.some(function (ev) { return ev.date === date && ev.title === pick; });
  if (dup) { $('pickNote').textContent = date.slice(5).replace('-', '월 ') + '일에 이미 있어요.'; return; }
  addEvent(pick, date, $('pickTime').value);
  $('pickNote').textContent = date.slice(5).replace('-', '월 ') + '일에 추가했어요. 다른 날짜도 눌러 추가할 수 있어요.';
}
$('pickToday').addEventListener('click', function () { if (pick) addPicked(todayStr); });
$('pickWeek').addEventListener('click', function () { if (pick) addPicked(weekRange(today).end); });
$('pickCancel').addEventListener('click', function () { setPick(null); });

/* 일정 한 줄을 입력칸으로 바꿔 제목·날짜·시간을 고치는 줄 */
function editRow(ev) {
  var li = el('li', 'ev editing');
  var title = el('input'); title.type = 'text'; title.maxLength = 60; title.value = ev.title; title.setAttribute('aria-label', '일정 제목');
  var date = el('input'); date.type = 'date'; date.value = ev.date; date.setAttribute('aria-label', '날짜');
  var time = el('input'); time.type = 'time'; time.value = ev.time || ''; time.setAttribute('aria-label', '시간 (선택)');
  var ok = el('button', 'save', '저장'); ok.type = 'button';
  var no = el('button', 'cancel', '취소'); no.type = 'button';
  function save() {
    var t = title.value.trim();
    if (!t || !date.value) { (t ? date : title).focus(); return; }
    ev.title = t; ev.date = date.value; ev.time = time.value;
    store('zip-events', state.events);
    editingId = null;
    selected = ev.date; viewY = Number(ev.date.slice(0, 4)); viewM = Number(ev.date.slice(5, 7)) - 1;   // 날짜를 바꿨으면 그 날로 따라감
    $('evDate').value = selected;
    renderCalendarAll(); updateDot();
  }
  function cancel() { editingId = null; renderEvList(); }
  ok.addEventListener('click', save);
  no.addEventListener('click', cancel);
  li.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    else if (e.key === 'Escape') cancel();
  });
  var fields = el('div', 'fields');
  fields.appendChild(title);
  var row = el('div', 'fields-row');
  row.appendChild(date); row.appendChild(time);
  fields.appendChild(row);
  var btns = el('div', 'btns');
  btns.appendChild(ok); btns.appendChild(no);
  li.appendChild(fields); li.appendChild(btns);
  setTimeout(function () { title.focus(); }, 0);
  return li;
}

// 달력 아래 "다가오는 일정" 알림: 정기 배출 일정, 월세 D-day, 일주일 안 일정
function renderCalNoti() {
  var box = $('notiList');
  box.textContent = '';
  var rows = [];
  var rd = nextRentDate(), rdiff = dayDiff(fmt(rd));
  rows.push({ ico: '💸', t: '월세 납부', s: '매월 ' + settings.rentDay + '일 · ' + settings.rent + '만원', b: rdiff === 0 ? '오늘' : 'D-' + rdiff, hot: rdiff <= 3 });
  var nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);
  var endDate = fmt(nextWeek);
  var scheduledEvents = state.events.concat(trashEventsBetween(todayStr, endDate));
  sortEvents(scheduledEvents).forEach(function (ev) {
    var diff = dayDiff(ev.date);
    if (diff < 0 || diff > 7 || ev.done) return;
    rows.push({
      ico: ev.kind === 'trash' ? trashIco(ev.title) : '📌',
      t: ev.title,
      s: ev.date.slice(5).replace('-', '월 ') + '일 ' + (ev.time || '종일') + (ev.detail ? ' · ' + ev.detail : ''),
      b: diff === 0 ? '오늘' : 'D-' + diff,
      hot: diff <= 1
    });
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
// 달력·일정 목록·알림과 할 일 요약을 한 번에 다시 그림
export function renderCalendarAll() {
  renderGrid();
  renderEvList();
  renderCalNoti();
  renderEventSummary();
}

$('evDate').value = selected;
// 일정 추가 폼: 제목, 날짜, 시간(선택)
// 일정 한 개를 저장하고 그 날짜로 달력·목록을 맞춤 (직접 입력과 항목 버튼 둘 다 이걸 씀)
function addEvent(title, date, time) {
  state.events.push({ id: Date.now() + Math.floor(Math.random() * 1000), date: date, time: time || '', title: title, done: false });
  store('zip-events', state.events);
  selected = date; viewY = Number(date.slice(0, 4)); viewM = Number(date.slice(5, 7)) - 1;
  var range = weekRange(today);
  mode = date === todayStr ? 'today' : mode === 'week' && date >= range.start && date <= range.end ? 'week' : 'day';
  query = ''; $('searchInput').value = '';
  $('evDate').value = date;
  renderCalendarAll(); updateDot();
}
$('evForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var title = $('evTitle').value.trim(), date = $('evDate').value;
  if (!title || !date) return;
  addEvent(title, date, $('evTime').value);
  $('evTitle').value = ''; $('evTime').value = '';
});
renderPresets();

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
$('btnAdd').addEventListener('click', function () { showView('calendar'); });   // 헤더 + 버튼: 일정 화면으로 (항목 버튼에서 고르거나 직접 입력)

registerView('calendar', renderCalendarAll);
