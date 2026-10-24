/* 캘린더: 달력, 일정 추가(카테고리 항목 버튼 + 날짜 누르기 / 직접 입력)·수정·삭제, 상단 검색, 캘린더 아래 알림 */
import { $, el, pad, fmt, today, todayStr, dayDiff, sortEvents } from '../core/utils.js';
import { load, store } from '../core/storage.js';
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
// 달력 보기 방식: month(월간) / week(주간, 선택한 날이 든 주)
var calView = 'month';
// 달력 칸 안 일정 막대 색: 일정 기록하기 카테고리(집 관리 등)마다 다른 색, 직접 입력한 일정은 파랑, 쓰레기 배출은 초록
var CAT_COLORS = ['#ff8a4c', '#2ec4b6', '#f5b301', '#e56b9a', '#7c6cf5'];
function evColor(ev) {
  if (ev.kind === 'trash') return '#3bb273';
  for (var i = 0; i < EV_PRESETS.length; i++) { if (EV_PRESETS[i].items.indexOf(ev.title) >= 0) return CAT_COLORS[i % CAT_COLORS.length]; }
  return '#4a90e2';
}
// 날짜 문자열이 속한 주의 일요일(주간 보기 시작일)
function sundayOf(ds) { var p = ds.split('-'), d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); d.setDate(d.getDate() - d.getDay()); return d; }

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

// 달력을 그림: 월간은 그 달 전체(앞뒤 달 날짜는 흐리게), 주간은 선택한 날이 든 한 주.
// 칸마다 날짜 숫자 + 일정 막대(월간 최대 3개, 넘으면 "+N개 더", 주간은 전부). 오늘은 검은 동그라미, 선택한 날은 연한 배경
function renderGrid() {
  var grid = $('calGrid');
  grid.textContent = '';
  grid.classList.toggle('week', calView === 'week');
  ['일', '월', '화', '수', '목', '금', '토'].forEach(function (d, i) { grid.appendChild(el('div', 'cal-dow' + (i === 0 ? ' sun' : ''), d)); });
  var start, count;
  if (calView === 'week') {
    start = sundayOf(selected); count = 7;
    var end = new Date(start); end.setDate(end.getDate() + 6);
    $('calTitle').textContent = start.getFullYear() + '.' + pad(start.getMonth() + 1) + '.' + pad(start.getDate()) + ' ~ ' + pad(end.getMonth() + 1) + '.' + pad(end.getDate());
  } else {
    var first = new Date(viewY, viewM, 1);
    start = new Date(first); start.setDate(1 - first.getDay());
    count = Math.ceil((first.getDay() + new Date(viewY, viewM + 1, 0).getDate()) / 7) * 7;
    $('calTitle').textContent = viewY + '.' + pad(viewM + 1);
  }
  var maxChips = calView === 'week' ? 12 : 3;
  // 같은 제목의 일정이 이어지는 날(예: 병원 예약 8~10일)은 막대가 이어지도록 같은 줄(slot)에 놓고 가운데 경계를 터 줌
  var days = [];
  for (var n = 0; n < count; n++) {
    var dd = new Date(start); dd.setDate(start.getDate() + n);
    var dstr = fmt(dd);
    var dayEvs = sortEvents(state.events.filter(function (ev) { return ev.date === dstr; }))
      .concat(trashEventsBetween(dstr, dstr))   // 내 일정 먼저, 배출 일정은 뒤에
      .map(function (ev) { return Object.assign({}, ev); });   // 이어짐 표시를 저장된 일정에 남기지 않도록 복사본 사용
    var slots = [], prev = days[n - 1];
    if (prev && dd.getDay() !== 0) {              // 일요일은 줄이 바뀌므로 이어붙이지 않음
      dayEvs.forEach(function (ev) {
        if (ev.kind === 'trash') return;
        for (var q = 0; q < prev.slots.length; q++) {
          var pe = prev.slots[q];
          if (pe && !pe.linked && pe.kind !== 'trash' && pe.title === ev.title) { slots[q] = ev; ev.joinPrev = true; pe.joinNext = true; pe.linked = true; return; }
        }
      });
    }
    dayEvs.forEach(function (ev) {
      if (slots.indexOf(ev) >= 0) return;
      var q = 0; while (slots[q]) q++;
      slots[q] = ev;
    });
    days.push({ date: dd, ds: dstr, evs: dayEvs, slots: slots });
  }
  days.forEach(function (day, i) {
    var d = day.date, ds = day.ds, evs = day.evs;
    var cell = el('div', 'cal-day');
    cell.tabIndex = 0; cell.setAttribute('role', 'button');
    cell.setAttribute('data-date', ds);
    if (calView === 'month' && d.getMonth() !== viewM) cell.classList.add('out');
    if (d.getDay() === 0) cell.classList.add('sun');
    if (ds === todayStr) cell.classList.add('today');
    if (ds === selected) cell.classList.add('sel');
    cell.appendChild(el('span', 'dn', String(d.getDate())));
    var chips = el('div', 'chips2');
    for (var q = 0; q < Math.min(day.slots.length, maxChips); q++) {
      var ev = day.slots[q];
      if (!ev) { chips.appendChild(el('div', 'cev gap', ' ')); continue; }
      var c = el('div', 'cev' + (ev.done ? ' done' : '') + (ev.joinPrev ? ' join-prev' : '') + (ev.joinNext ? ' join-next' : ''));
      c.style.setProperty('--c', evColor(ev));
      c.title = (ev.time ? ev.time + ' ' : '') + ev.title;
      if (ev.joinPrev) c.appendChild(document.createTextNode(' '));   // 이어지는 막대에는 제목을 다시 쓰지 않음
      else {
        if (ev.time && ev.kind !== 'trash') c.appendChild(el('i', null, ev.time));
        c.appendChild(document.createTextNode(ev.title));
      }
      chips.appendChild(c);
    }
    if (day.slots.length > maxChips) chips.appendChild(el('div', 'cev-more', '+' + (day.slots.length - maxChips) + '개 더'));
    cell.appendChild(chips);
    var mark = el('span', 'mark');   // 좁은 화면에서는 글자 대신 점
    for (var k = 0; k < Math.min(evs.length, 3); k++) mark.appendChild(el('i'));
    cell.appendChild(mark);
    grid.appendChild(cell);
  });
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
$('calGrid').addEventListener('keydown', function (e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('cal-day')) { e.preventDefault(); e.target.click(); }
});
// 이전 / 다음 (월간은 한 달, 주간은 한 주) / 오늘 버튼
function shift(dir) {
  if (calView === 'week') {
    var d = sundayOf(selected); d.setDate(d.getDate() + 7 * dir);
    selected = fmt(d); viewY = d.getFullYear(); viewM = d.getMonth(); $('evDate').value = selected;
    renderCalendarAll();
  } else {
    viewM += dir; if (viewM < 0) { viewM = 11; viewY--; } if (viewM > 11) { viewM = 0; viewY++; }
    renderGrid();
  }
}
$('calPrev').addEventListener('click', function () { shift(-1); });
$('calNext').addEventListener('click', function () { shift(1); });
$('calToday').addEventListener('click', function () {
  viewY = today.getFullYear(); viewM = today.getMonth(); selected = todayStr; $('evDate').value = selected; renderCalendarAll();
});
// 월간 / 주간 보기 전환
function setCalView(v) {
  calView = v;
  if (v === 'month') { viewY = Number(selected.slice(0, 4)); viewM = Number(selected.slice(5, 7)) - 1; }
  $('viewWeek').classList.toggle('on', v === 'week');
  $('viewMonth').classList.toggle('on', v === 'month');
  renderGrid();
}
$('viewWeek').addEventListener('click', function () { setCalView('week'); });
$('viewMonth').addEventListener('click', function () { setCalView('month'); });

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
    var name = el('span', 'name');
    if (ev.category) name.appendChild(el('small', 'ev-category', ev.category));
    name.appendChild(document.createTextNode(ev.title));
    li.appendChild(name);
    li.tabIndex = 0;
    li.addEventListener('pointerup', function (e) {
      if (e.pointerType === 'touch' && !e.target.closest('button, input')) li.classList.toggle('show-actions');
    });
    var actions = el('span', 'ev-actions');
    var edit = el('button', 'edit', '수정');
    edit.type = 'button'; edit.title = '일정 수정'; edit.setAttribute('aria-label', ev.title + ' 일정 수정');
    edit.addEventListener('click', function () { editingId = ev.id; renderEvList(); });
    actions.appendChild(edit);
    var del = el('button', 'del', '×');
    del.type = 'button'; del.title = '삭제'; del.setAttribute('aria-label', ev.title + ' 일정 삭제');
    del.addEventListener('click', function () {
      state.events = state.events.filter(function (x) { return x.id !== ev.id; });
      store('zip-events', state.events);
      renderCalendarAll(); updateDot();
    });
    actions.appendChild(del);
    li.appendChild(actions);
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
  presetGroups().forEach(function (cat) {
    var g = el('div', 'ev-cat');
    g.appendChild(el('h3', null, cat.ico + ' ' + cat.name));
    var row = el('div', 'chips');
    function itemButton(name) {
      var active = pick === name && pickCategory === cat.name;
      var b = el('button', 'chip' + (active ? ' on' : ''), name);
      b.type = 'button'; b.setAttribute('aria-pressed', String(active));
      b.addEventListener('click', function () { setPick(active ? null : name, cat.name); });
      return b;
    }
    cat.items.forEach(function (name) { row.appendChild(itemButton(name)); });
    customPresets.filter(function (item) { return item.category === cat.name; }).forEach(function (item) {
      var group = el('span', 'ev-preset-item');
      group.addEventListener('pointerup', function (e) {
        if (e.pointerType === 'touch') group.classList.add('show-actions');
      });
      group.appendChild(itemButton(item.title));
      var edit = el('button', 'ev-preset-action', '수정'); edit.type = 'button';
      edit.setAttribute('aria-label', item.title + ' 항목 수정');
      edit.addEventListener('click', function () { editPreset(item); });
      var del = el('button', 'ev-preset-action', '삭제'); del.type = 'button';
      del.setAttribute('aria-label', item.title + ' 항목 삭제');
      del.addEventListener('click', function () {
        customPresets = customPresets.filter(function (other) { return other.id !== item.id; });
        store('zip-event-presets', customPresets);
        if (editingPresetId === item.id) resetPresetEditor();
        if (pick === item.title && pickCategory === item.category) setPick(null);
        renderPresets(); renderCategoryOptions();
      });
      group.appendChild(edit); group.appendChild(del); row.appendChild(group);
    });
    g.appendChild(row); box.appendChild(g);
  });
}
// 항목을 고르거나(이름) 해제(null)하고 안내 줄을 맞춤
function setPick(name) {
  pick = name;
  $('calGrid').classList.toggle('picking', !!pick);   // 항목을 골라 두면 달력 칸에 "+" 커서
  $('pickBar').hidden = !pick;
  if (pick) { $('pickName').textContent = '「' + pick + '」'; $('pickNote').textContent = '달력에서 날짜를 눌러 주세요.'; }
  renderPresets();
}
// 골라 둔 항목을 이 날짜에 일정으로 추가 (같은 날 같은 이름이 이미 있으면 건너뜀)
function addPicked(date) {
  var dup = state.events.some(function (ev) { return ev.date === date && ev.title === pick && (ev.category || '') === pickCategory; });
  if (dup) { $('pickNote').textContent = date.slice(5).replace('-', '월 ') + '일에 이미 있어요.'; return; }
  addEvent(pick, date, $('pickTime').value, pickCategory);
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
  var categoryLabel = el('label', null, '카테고리 (선택)');
  var category = document.createElement('select'); categorySelect(category, ev.category || '미분류');
  categoryLabel.appendChild(category);
  var clearCategory = el('button', 'cancel', '카테고리 삭제'); clearCategory.type = 'button';
  clearCategory.addEventListener('click', function () { category.value = '미분류'; category.focus(); });
  var ok = el('button', 'save', '저장'); ok.type = 'button';
  var no = el('button', 'cancel', '취소'); no.type = 'button';
  function save() {
    var t = title.value.trim();
    if (!t || !date.value) { (t ? date : title).focus(); return; }
    ev.title = t; ev.date = date.value; ev.time = time.value; ev.category = category.value.trim();
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
    if (e.target.tagName === 'BUTTON') return;
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    else if (e.key === 'Escape') cancel();
  });
  var fields = el('div', 'fields');
  fields.appendChild(title);
  fields.appendChild(categoryLabel);
  fields.appendChild(clearCategory);
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
function renderCategoryOptions() {
  categorySelect($('evCategory'), $('evCategory').value);
}

export function renderCalendarAll() {
  renderCategoryOptions();
  renderGrid();
  renderEvList();
  renderCalNoti();
  renderEventSummary();
}

$('evDate').value = selected;
// 일정 추가 폼: 제목, 날짜, 시간(선택)
// 일정 한 개를 저장하고 그 날짜로 달력·목록을 맞춤 (직접 입력과 항목 버튼 둘 다 이걸 씀)
function addEvent(title, date, time, category) {
  state.events.push({ id: Date.now() + Math.floor(Math.random() * 1000), date: date, time: time || '', title: title, category: (category || '').trim(), done: false });
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
  var category = $('evCategory').value;
  if (!categories.some(function (cat) { return cat.name === category; })) { $('evPresetMessage').textContent = '목록에서 카테고리를 선택해 주세요.'; return; }
  var duplicate = categories.some(function (cat) { return cat.name === category && cat.items.indexOf(title) !== -1; })
    || customPresets.some(function (item) { return item.id !== editingPresetId && item.title === title && item.category === category; });
  if (editingPresetId && duplicate) { $('evPresetMessage').textContent = '해당 카테고리에 같은 항목이 이미 있어요.'; return; }
  if (editingPresetId) {
    var item = customPresets.find(function (item) { return item.id === editingPresetId; });
    if (!item) return;
    if (pick === item.title && pickCategory === item.category) { pick = title; pickCategory = category; $('pickName').textContent = '「' + title + '」'; }
    item.title = title; item.category = category;
  } else {
    if (!duplicate) customPresets.push({ id: crypto.randomUUID(), title: title, category: category });
    addEvent(title, date, $('evTime').value, category);
  }
  store('zip-event-presets', customPresets);
  resetPresetEditor(); renderPresets(); renderCategoryOptions();
  $('evPresetMessage').textContent = '카테고리 아래 항목 버튼에 반영했어요. 버튼을 선택해 다른 날짜에도 추가할 수 있어요.';
});
saveCategoryData();
refreshCategories();

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
