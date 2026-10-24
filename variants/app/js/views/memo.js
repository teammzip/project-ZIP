/* 메모장: 마이페이지 "메모" 탭 + 홈의 메모 카드
 * - 메모 한 개: { id, title, body, color, pinned, checklist, items: [{ text, done }], createdAt, updatedAt }
 *   checklist 가 true 면 items(줄마다 체크) 를, 아니면 body(글) 를 씀. 바꾸면 서로 변환 (글 한 줄 = 항목 하나)
 * - 쓰는 대로 자동 저장 (localStorage 'zip-memos'), 고정한 메모가 맨 위, 그다음 최근 수정 순
 * - 홈 메모 위젯: 대표 메모(고정 또는 최근) 한 장 + 그다음 메모 3개 목록 + 빠른 메모. 누르면 메모장에서 그 메모를 엶
 * 서버를 붙이면 DB 의 memos 표 (frontend/API.md 참고) */
import { $, el } from '../core/utils.js';
import { load, store } from '../core/storage.js';
import { registerView, showView } from '../core/router.js';

// 메모 색: [이름, 배경, 진한 테두리]
var COLORS = [['노랑', '#fff6c7', '#f2d24b'], ['분홍', '#ffe3ea', '#ff9db3'], ['하늘', '#e1f0ff', '#7db6f5'], ['초록', '#e3f7e8', '#7fd394'], ['보라', '#eee9ff', '#a99cf7'], ['흰색', '#ffffff', '#d5d9e2']];
var colorOf = function (name) { return COLORS.filter(function (c) { return c[0] === name; })[0] || COLORS[0]; };

var memos = load('zip-memos', null);
if (!Array.isArray(memos)) {   // 처음 한 번 둘러보기용 예시 메모
  var now = Date.now();
  memos = [
    { id: now - 2, title: '장보기', body: '', color: '노랑', pinned: true, checklist: true, items: [{ text: '두부', done: false }, { text: '계란 한 판', done: true }, { text: '키친타월', done: false }, { text: '방울토마토', done: false }], createdAt: now - 86400000, updatedAt: now - 3600000 },
    { id: now - 1, title: '관리비 문의할 것', body: '11월 관리비에 엘리베이터 수리비 포함인지 확인하기\n관리사무소 평일 9시 ~ 6시', color: '분홍', pinned: false, checklist: false, items: [], createdAt: now - 172800000, updatedAt: now - 7200000 }
  ];
  store('zip-memos', memos);
}

var currentId = null, query = '', saveTimer = 0;
var find = function (id) { return memos.filter(function (m) { return m.id === id; })[0]; };
function sorted(list) { return list.slice().sort(function (a, b) { return (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt); }); }
function textOf(m) { return m.checklist ? m.items.map(function (it) { return (it.done ? '✓ ' : '· ') + it.text; }).join('\n') : m.body; }
// 미리보기 줄: 제목 없이 쓴 메모는 첫 줄이 제목 대신 쓰이니 미리보기에서는 뺌
function previewLines(m, mark) {
  var lines = m.checklist ? m.items.map(function (it) { return mark(it) + it.text; }) : m.body.split('\n');
  return m.title.trim() ? lines : lines.slice(1);
}
function titleOf(m) { return m.title.trim() || (textOf(m).split('\n')[0] || '').replace(/^[✓·] /, '').slice(0, 30) || '새 메모'; }
function when(t) {
  var d = new Date(t), diff = Date.now() - t;
  if (diff < 60000) return '방금';
  if (diff < 3600000) return Math.floor(diff / 60000) + '분 전';
  if (new Date().toDateString() === d.toDateString()) return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
}
function save() { store('zip-memos', memos); renderHome(); }

/* ---------- 목록 ---------- */
function renderList() {
  var q = query.trim().toLowerCase();
  var list = sorted(memos).filter(function (m) { return !q || (m.title + '\n' + textOf(m)).toLowerCase().indexOf(q) >= 0; });
  $('memoCount').textContent = memos.length + '개';
  var box = $('memoList'); box.textContent = '';
  if (!list.length) { box.appendChild(el('p', 'memo-none', q ? '찾는 메모가 없어요.' : '아직 메모가 없어요. 새 메모를 만들어 보세요.')); return; }
  list.forEach(function (m) {
    var c = colorOf(m.color);
    var b = el('button', 'memo-item' + (m.id === currentId ? ' on' : ''));
    b.type = 'button';
    b.style.setProperty('--memo-bg', c[1]); b.style.setProperty('--memo-line', c[2]);
    var top = el('div', 'memo-item-top');
    top.appendChild(el('b', null, (m.pinned ? '📌 ' : '') + titleOf(m)));
    top.appendChild(el('time', null, when(m.updatedAt)));
    b.appendChild(top);
    var preview = previewLines(m, function (it) { return it.done ? '✓ ' : '· '; }).filter(Boolean).join('  ');
    if (preview) b.appendChild(el('small', null, preview));
    if (m.checklist && m.items.length) b.appendChild(el('span', 'memo-progress', m.items.filter(function (i) { return i.done; }).length + ' / ' + m.items.length + ' 완료'));
    b.addEventListener('click', function () { openMemo(m.id); });
    box.appendChild(b);
  });
}

/* ---------- 쓰기 ---------- */
export function openMemo(id) {
  currentId = id;
  var m = find(id);
  $('memoEmpty').hidden = !!m;
  $('memoEdit').hidden = !m;
  $('memoApp').classList.toggle('editing', !!m);   // 모바일: 목록 대신 쓰기 화면
  renderList();
  if (!m) return;
  var c = colorOf(m.color);
  $('memoEditor').style.setProperty('--memo-bg', c[1]);
  $('memoTitle').value = m.title;
  $('memoBody').value = m.body;
  $('memoBody').hidden = m.checklist;
  $('memoItems').hidden = !m.checklist;
  $('memoPin').setAttribute('aria-pressed', m.pinned);
  $('memoCheck').setAttribute('aria-pressed', m.checklist);
  $('memoCheck').querySelector('span').textContent = m.checklist ? '글로 바꾸기' : '체크리스트';
  renderColors(m);
  if (m.checklist) renderItems(m);
  $('memoSaved').textContent = '마지막 수정 ' + when(m.updatedAt);
}
function touch(m, now) {
  m.updatedAt = Date.now();
  clearTimeout(saveTimer);
  $('memoSaved').textContent = '저장 중…';
  var go = function () { save(); renderList(); $('memoSaved').textContent = '자동 저장됨 · ' + when(m.updatedAt); };
  if (now) go(); else saveTimer = setTimeout(go, 400);   // 글자를 칠 때마다 저장하지 않고 잠깐 멈추면 저장
}
function renderColors(m) {
  var box = $('memoColors'); box.textContent = '';
  COLORS.forEach(function (c) {
    var b = el('button', 'memo-color' + (m.color === c[0] ? ' on' : ''));
    b.type = 'button'; b.style.background = c[1]; b.style.borderColor = c[2];
    b.setAttribute('aria-label', c[0]); b.setAttribute('aria-pressed', m.color === c[0]);
    b.addEventListener('click', function () { m.color = c[0]; touch(m, true); openMemo(m.id); });
    box.appendChild(b);
  });
}
function renderItems(m) {
  var box = $('memoItems'); box.textContent = '';
  m.items.forEach(function (it, i) {
    var row = el('div', 'memo-check-row' + (it.done ? ' done' : ''));
    var cb = el('input'); cb.type = 'checkbox'; cb.checked = it.done; cb.setAttribute('aria-label', (it.text || '항목') + ' 완료');
    cb.addEventListener('change', function () { it.done = cb.checked; row.classList.toggle('done', it.done); touch(m, true); });
    var tx = el('input', 'memo-check-text'); tx.type = 'text'; tx.maxLength = 100; tx.value = it.text; tx.placeholder = '할 일';
    tx.addEventListener('input', function () { it.text = tx.value; touch(m); });
    tx.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); m.items.splice(i + 1, 0, { text: '', done: false }); touch(m, true); renderItems(m); focusItem(i + 1); }
      if (e.key === 'Backspace' && !tx.value && m.items.length > 1) { e.preventDefault(); m.items.splice(i, 1); touch(m, true); renderItems(m); focusItem(Math.max(0, i - 1)); }
    });
    var x = el('button', 'memo-check-x', '×'); x.type = 'button'; x.setAttribute('aria-label', '항목 지우기');
    x.addEventListener('click', function () { m.items.splice(i, 1); touch(m, true); renderItems(m); });
    row.appendChild(cb); row.appendChild(tx); row.appendChild(x);
    box.appendChild(row);
  });
  var add = el('button', 'memo-check-add', '+ 항목 추가'); add.type = 'button';
  add.addEventListener('click', function () { m.items.push({ text: '', done: false }); touch(m, true); renderItems(m); focusItem(m.items.length - 1); });
  box.appendChild(add);
}
function focusItem(i) { var t = $('memoItems').querySelectorAll('.memo-check-text')[i]; if (t) t.focus(); }

function newMemo(body) {
  var now = Date.now();
  var m = { id: now, title: '', body: body || '', color: '노랑', pinned: false, checklist: false, items: [], createdAt: now, updatedAt: now };
  memos.push(m); save();
  return m;
}

$('memoNew').addEventListener('click', function () { query = ''; $('memoSearch').value = ''; var m = newMemo(); openMemo(m.id); $('memoTitle').focus(); });
$('memoSearch').addEventListener('input', function () { query = this.value; renderList(); });
$('memoBack').addEventListener('click', function () { openMemo(null); });
$('memoTitle').addEventListener('input', function () { var m = find(currentId); if (m) { m.title = this.value; touch(m); } });
$('memoBody').addEventListener('input', function () { var m = find(currentId); if (m) { m.body = this.value; touch(m); } });
$('memoPin').addEventListener('click', function () { var m = find(currentId); if (!m) return; m.pinned = !m.pinned; touch(m, true); openMemo(m.id); });
$('memoCheck').addEventListener('click', function () {
  var m = find(currentId); if (!m) return;
  if (m.checklist) m.body = m.items.map(function (i) { return i.text; }).filter(Boolean).join('\n');
  else { m.items = m.body.split('\n').map(function (t) { return t.trim(); }).filter(Boolean).map(function (t) { return { text: t, done: false }; }); if (!m.items.length) m.items = [{ text: '', done: false }]; }
  m.checklist = !m.checklist;
  touch(m, true); openMemo(m.id);
});
$('memoDel').addEventListener('click', function () {
  var m = find(currentId); if (!m) return;
  if (!confirm('"' + titleOf(m) + '" 메모를 지울까요?')) return;
  memos = memos.filter(function (x) { return x.id !== m.id; });
  save(); openMemo(null);
});

/* ---------- 홈 메모 카드 ---------- */
function goMemo(id) { showView('memo'); openMemo(id); }
function renderHome() {
  var all = sorted(memos), top = all[0];
  $('homeMemoCount').textContent = memos.length + '개';
  var feat = $('homeMemoFeature'); feat.textContent = '';
  var list = $('homeMemoList'); list.textContent = '';
  list.hidden = all.length < 2;
  if (!top) {
    feat.style.removeProperty('--memo-bg');
    feat.appendChild(el('p', 'mw-none', '아직 메모가 없어요.\n아래 칸에 적고 Enter 를 눌러 보세요.'));
    return;
  }
  // 대표 메모: 줄 노트 모양. 체크리스트면 여기서 바로 체크
  var c = colorOf(top.color);
  feat.style.setProperty('--memo-bg', c[1]); feat.style.setProperty('--memo-line', c[2]);
  var head = el('button', 'mw-feature-head'); head.type = 'button';
  head.appendChild(el('b', null, (top.pinned ? '📌 ' : '') + titleOf(top)));
  head.appendChild(el('time', null, when(top.updatedAt)));
  head.addEventListener('click', function () { goMemo(top.id); });
  feat.appendChild(head);
  if (top.checklist) {
    var ul = el('ul', 'mw-checks');
    top.items.slice(0, 5).forEach(function (it) {
      if (!it.text) return;
      var li = el('li', it.done ? 'done' : null), lb = el('label'), cb = el('input');
      cb.type = 'checkbox'; cb.checked = it.done;
      cb.addEventListener('change', function () { it.done = cb.checked; top.updatedAt = Date.now(); save(); if (currentId === top.id) openMemo(top.id); });
      lb.appendChild(cb); lb.appendChild(el('span', null, it.text));
      li.appendChild(lb); ul.appendChild(li);
    });
    feat.appendChild(ul);
    var left = top.items.filter(function (i) { return i.text && !i.done; }).length;
    feat.appendChild(el('small', 'mw-left', left ? left + '개 남았어요' : '모두 끝냈어요 🎉'));
  } else {
    var p = el('p', 'mw-text', previewLines(top, function () { return ''; }).join('\n') || titleOf(top));
    p.addEventListener('click', function () { goMemo(top.id); });
    feat.appendChild(p);
  }
  // 그다음 메모 3개
  all.slice(1, 4).forEach(function (m) {
    var li = el('li'), b = el('button', 'mw-item'); b.type = 'button';
    b.style.setProperty('--memo-line', colorOf(m.color)[2]);
    var t = el('span', 'mw-item-t');
    t.appendChild(el('b', null, (m.pinned ? '📌 ' : '') + titleOf(m)));
    var pv = previewLines(m, function (it) { return it.done ? '✓ ' : ''; }).filter(Boolean).join(' · ');
    if (pv) t.appendChild(el('small', null, pv));
    b.appendChild(t);
    b.appendChild(el('time', null, when(m.updatedAt)));
    b.addEventListener('click', function () { goMemo(m.id); });
    li.appendChild(b); list.appendChild(li);
  });
}
$('homeMemoForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var v = $('homeMemoInput').value.trim();
  if (!v) return;
  newMemo(v);
  $('homeMemoInput').value = '';
});

registerView('memo', function () {
  // PC 는 처음 들어오면 맨 위 메모를 바로 엶, 모바일은 목록부터
  var keep = currentId && find(currentId);
  if (keep) openMemo(currentId);
  else if (window.innerWidth > 900 && memos.length) openMemo(sorted(memos)[0].id);
  else openMemo(null);
});
renderHome();
