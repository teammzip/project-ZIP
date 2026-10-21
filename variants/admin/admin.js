/* 관리자 화면: 회원 관리(기간·영구 정지, 밴 횟수 기록·검색, 일괄 정지) + 커뮤니티 게시글 관리(글·댓글 삭제 + 작성자 정지)
 * 앱 화면과 같은 localStorage 를 읽고 고친다.
 *   zip-posts           커뮤니티 글 (앱과 공유)
 *   zip-posts-removed   관리자가 지운 기본 예시 글 번호 (앱이 다시 채워 넣지 않게 함)
 *   zipban-records      이용 정지 기록·횟수·이력 (shared/zip-ban.js 가 읽고 쓰며, 로그인·가입·글쓰기를 막는 데 쓰임)
 *   zip-account / zip-settings  내 계정 정보 */
import { SEED_POSTS } from '../app/js/data/posts-seed.js';

var Ban = window.ZipBan;
function load(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; } }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { } }
function $(id) { return document.getElementById(id); }
function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

// ---- 데이터 ----
var posts, removed, bans;
function reload() {
  removed = load('zip-posts-removed', []);
  bans = Ban.read();
  posts = load('zip-posts', []);
  if (!Array.isArray(posts)) posts = [];
  // 앱을 한 번도 안 열었어도 기본 예시 글이 보이게 (지운 글은 제외)
  SEED_POSTS.forEach(function (sp) {
    if (removed.indexOf(sp.id) < 0 && !posts.some(function (p) { return p.id === sp.id; })) posts.push(JSON.parse(JSON.stringify(sp)));
  });
  posts = posts.filter(function (p) { return removed.indexOf(p.id) < 0; });
}
function savePosts() { save('zip-posts', posts); }
function isBanned(nick) { return Ban.isActive(bans[nick]); }

function rel(ts) {
  var m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return m + '분 전';
  var h = Math.floor(m / 60);
  if (h < 24) return h + '시간 전';
  return Math.floor(h / 24) + '일 전';
}

// 회원 목록: 글·댓글 작성자 + 정지 기록이 있는 사람 (내 계정은 목록에서 뺌)
var ME = Ban.me();
function members() {
  var map = {};
  function get(nick) { return map[nick] || (map[nick] = { nick: nick, uid: '', me: false, posts: 0, cmts: 0 }); }
  posts.forEach(function (p) {
    get(p.author).posts++;
    (p.comments || []).forEach(function (c) { get(c.author).cmts++; });
  });
  Object.keys(bans).forEach(get);
  return Object.keys(map).filter(function (k) { return k !== ME.nick; }).map(function (k) {
    var m = map[k], r = bans[k];
    m.count = r ? r.count || 0 : 0; m.warns = r ? r.warns || 0 : 0; m.rec = r || null; m.active = isBanned(k);
    return m;
  });
}

// 정지 걸기 또는 경고 주기 (days === 'warn' 이면 경고만)
function act(nick, days, reason) { if (days === 'warn') Ban.warn(nick, reason); else Ban.ban(nick, days, reason); }
function daysText(e) { return e.warn ? '경고' : e.days ? e.days + '일 정지' : '영구 정지'; }
// 가입일 (시안에는 가입 기록이 없어서 닉네임으로 정한 고정 예시 날짜. 실제로는 users.created_at)
function joinedAt(nick) {
  var h = 0; for (var i = 0; i < nick.length; i++) h = (h * 31 + nick.charCodeAt(i)) >>> 0;
  return new Date(2026, 9, 1).getTime() - (20 + h % 380) * 86400000;
}
function fmtDate(ts) { var d = new Date(ts); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

// ---- 확인창: 정지 기간·사유를 고르고 확인/취소. 취소하면 null, 확인하면 { days: null(조치 안 함) | 'warn'(경고) | 0(영구) | 1·3·5·10, reason } ----
function dialog(o) {
  return new Promise(function (resolve) {
    $('mdTitle').textContent = o.title;
    $('mdMsg').textContent = o.msg;
    var sel = $('mdDays'); sel.textContent = '';
    function opt(v, t) { var x = el('option', null, t); x.value = v; sel.appendChild(x); }
    if (o.allowNone) opt('none', '조치 안 함');
    opt('warn', '경고만 (정지 없음)');
    [1, 3, 5, 10].forEach(function (d) { opt(String(d), d + '일'); });
    opt('perm', '영구');
    sel.value = o.allowNone ? 'none' : (o.defaultPerm ? 'perm' : 'warn');
    sel.parentNode.hidden = !!o.warnOnly;   // 경고 전용 창에서는 기간 선택을 숨김
    $('mdReason').value = '';
    $('mdOk').textContent = o.okText || '확인';
    $('modal').hidden = false;
    function close(val) {
      $('modal').hidden = true;
      $('mdOk').onclick = $('mdCancel').onclick = $('modal').onclick = null;
      resolve(val);
    }
    $('mdOk').onclick = function () {
      var v = sel.value;
      close({ days: v === 'none' ? null : v === 'warn' ? 'warn' : v === 'perm' ? 0 : Number(v), reason: $('mdReason').value.trim() });
    };
    $('mdCancel').onclick = function () { close(null); };
    $('modal').onclick = function (e) { if (e.target === $('modal')) close(null); };
  });
}

// ---- 화면 ----
var tab = 'members', openId = null, openHist = null, selected = {};

function renderStats() {
  var ms = members(), cm = 0, actv = 0, total = 0, warns = 0;
  posts.forEach(function (p) { cm += (p.comments || []).length; });
  ms.forEach(function (m) { if (m.active) actv++; total += m.count; warns += m.warns; });
  var items = [[ms.length, '전체 회원'], [actv, '지금 정지 중'], [total, '누적 밴 횟수'], [warns, '누적 경고'], [posts.length, '게시글'], [cm, '댓글']];
  var box = $('stats'); box.textContent = '';
  items.forEach(function (it) { var s = el('div', 'stat'); s.appendChild(el('b', null, String(it[0]))); s.appendChild(el('span', null, it[1])); box.appendChild(s); });
}

// 지금 조건(검색·상태·밴 횟수·정렬)에 맞는 회원
function filteredMembers() {
  var q = $('mSearch').value.trim().toLowerCase(), st = $('mStatus').value, min = Number($('mMinBans').value) || 0, minW = Number($('mMinWarns').value) || 0;
  var list = members().filter(function (m) {
    if (st === 'ok' && m.active) return false;
    if (st === 'ban' && !m.active) return false;
    if (st === 'temp' && !(m.active && !m.rec.perm)) return false;
    if (st === 'perm' && !(m.active && m.rec.perm)) return false;
    if (m.count < min || m.warns < minW) return false;
    return !q || m.nick.toLowerCase().indexOf(q) >= 0 || m.uid.toLowerCase().indexOf(q) >= 0;
  });
  var sort = $('mSort').value;
  return list.sort(function (a, b) { return sort === 'bans' ? (b.count - a.count) || (b.warns - a.warns) : sort === 'warns' ? (b.warns - a.warns) || (b.count - a.count) : (b.posts + b.cmts) - (a.posts + a.cmts); });
}

function selectedNicks() { return Object.keys(selected).filter(function (k) { return selected[k]; }); }

function renderMembers() {
  var body = $('mBody'); body.textContent = '';
  var list = filteredMembers();
  var picked = selectedNicks();
  $('bulk').hidden = !picked.length;
  $('bulkCount').textContent = '선택 ' + picked.length + '명';
  $('mAll').checked = list.length > 0 && list.every(function (m) { return selected[m.nick]; });
  if (!list.length) { var tr = el('tr'), td = el('td', 'empty', '해당하는 회원이 없습니다.'); td.colSpan = 10; tr.appendChild(td); body.appendChild(tr); return; }
  list.forEach(function (m) {
    var tr = el('tr');
    var ck = el('td'), cb = el('input'); cb.type = 'checkbox'; cb.checked = !!selected[m.nick];
    cb.addEventListener('change', function () { selected[m.nick] = cb.checked; renderMembers(); });
    ck.appendChild(cb); tr.appendChild(ck);
    tr.appendChild(el('td', null, m.nick));
    tr.appendChild(el('td', null, m.uid || '-'));
    tr.appendChild(el('td', null, fmtDate(joinedAt(m.nick))));
    tr.appendChild(el('td', null, String(m.posts)));
    tr.appendChild(el('td', null, String(m.cmts)));
    tr.appendChild(el('td', 'cnt' + (m.warns >= 3 ? ' hot' : ''), m.warns + '회'));
    tr.appendChild(el('td', 'cnt' + (m.count >= 3 ? ' hot' : ''), m.count + '회'));
    var s = el('td');
    s.appendChild(el('span', 'badge ' + (m.active ? (m.rec.perm ? 'ban' : 'temp') : 'ok'), m.active ? Ban.label(m.rec) : '정상'));
    if (m.active && !m.rec.perm) s.appendChild(el('div', 'hint', Ban.fmt(m.rec.until) + ' 해제'));
    tr.appendChild(s);

    var actTd = el('td');
    var wb = el('button', 'btn', '경고'); wb.type = 'button';
    wb.addEventListener('click', function () {
      dialog({ title: '"' + m.nick + '" 회원 경고', msg: '경고만 남기고 정지는 걸지 않습니다. 사유를 적어 주세요. 경고 횟수가 1회 늘어납니다.', okText: '경고하기', warnOnly: true }).then(function (r) {
        if (!r) return; Ban.warn(m.nick, r.reason); renderAll();
      });
    });
    actTd.appendChild(wb); actTd.appendChild(document.createTextNode(' '));
    var b = el('button', 'btn' + (m.active ? '' : ' danger'), m.active ? '정지 해제' : '정지'); b.type = 'button';
    b.addEventListener('click', function () {
      if (m.active) { Ban.unban(m.nick); renderAll(); return; }
      dialog({ title: '"' + m.nick + '" 회원 정지', msg: '정지 기간과 사유를 정해 주세요. 정지 횟수가 1회 늘어납니다. (경고만 고르면 정지 없이 경고 횟수만 늘어납니다)', okText: '확인' }).then(function (r) {
        if (!r) return; act(m.nick, r.days, r.reason); renderAll();
      });
    });
    actTd.appendChild(b); actTd.appendChild(document.createTextNode(' '));
    var h = el('button', 'btn', openHist === m.nick ? '기록 닫기' : '기록'); h.type = 'button';
    h.addEventListener('click', function () { openHist = openHist === m.nick ? null : m.nick; renderMembers(); });
    actTd.appendChild(h);
    tr.appendChild(actTd);
    body.appendChild(tr);

    if (openHist === m.nick) {
      var dr = el('tr', 'detail'), dc = el('td'); dc.colSpan = 10;
      var hist = m.rec ? m.rec.history || [] : [];
      if (!hist.length) dc.appendChild(el('div', 'hint', '정지 기록이 없습니다.'));
      hist.slice().reverse().forEach(function (e, i) {
        dc.appendChild(el('div', 'hist', (hist.length - i) + '번째 · ' + Ban.fmt(e.at) + ' · ' + daysText(e) + (e.reason ? ' · 사유: ' + e.reason : '')));
      });
      dr.appendChild(dc); body.appendChild(dr);
    }
  });
}

function fillFilters() {
  var cats = [], regions = [];
  posts.forEach(function (p) { if (cats.indexOf(p.cat) < 0) cats.push(p.cat); if (p.region && regions.indexOf(p.region) < 0) regions.push(p.region); });
  function fill(sel, vals) {
    var cur = sel.value; while (sel.options.length > 1) sel.remove(1);
    vals.forEach(function (v) { var o = el('option', null, v); o.value = v; sel.appendChild(o); });
    sel.value = vals.indexOf(cur) >= 0 ? cur : '';
  }
  fill($('pCat'), cats); fill($('pRegion'), regions);
}

// 글·댓글을 지울 때 작성자 정지 여부를 바로 묻는다
function askDeleteAndBan(title, msg, author, doDelete) {
  var already = isBanned(author);
  dialog({ title: title, msg: msg + ' 작성자 "' + author + '"' + (already ? '는 이미 정지 중입니다.' : ' 님께 경고나 정지를 줄까요?'), allowNone: true, okText: '삭제' }).then(function (r) {
    if (!r) return;
    doDelete();
    if (r.days !== null) act(author, r.days, r.reason);
    renderAll();
  });
}

function renderPosts() {
  var q = $('pSearch').value.trim().toLowerCase(), cat = $('pCat').value, reg = $('pRegion').value;
  var body = $('pBody'); body.textContent = '';
  var list = posts.filter(function (p) {
    if (cat && p.cat !== cat) return false;
    if (reg && p.region !== reg) return false;
    return !q || (p.title + ' ' + p.body + ' ' + p.author).toLowerCase().indexOf(q) >= 0;
  }).sort(function (a, b) { return b.ts - a.ts; });
  if (!list.length) { var tr0 = el('tr'), td0 = el('td', 'empty', '게시글이 없습니다.'); td0.colSpan = 9; tr0.appendChild(td0); body.appendChild(tr0); return; }
  list.forEach(function (p) {
    var tr = el('tr');
    tr.appendChild(el('td', null, String(p.id).length > 6 ? '…' + String(p.id).slice(-4) : String(p.id)));
    var c = el('td'); c.appendChild(el('span', 'badge', p.cat)); tr.appendChild(c);
    var t = el('td'); var tb = el('button', 'title-btn', p.title); tb.type = 'button';
    tb.addEventListener('click', function () { openId = openId === p.id ? null : p.id; renderPosts(); });
    t.appendChild(tb); tr.appendChild(t);
    var a = el('td', null, p.author);
    if (isBanned(p.author)) { a.appendChild(document.createTextNode(' ')); a.appendChild(el('span', 'badge ban', '정지 중')); }
    tr.appendChild(a);
    tr.appendChild(el('td', null, p.region || '-'));
    tr.appendChild(el('td', null, rel(p.ts)));
    tr.appendChild(el('td', null, String(p.likes || 0)));
    tr.appendChild(el('td', null, String((p.comments || []).length)));
    var act = el('td'); var del = el('button', 'btn danger', '삭제'); del.type = 'button';
    del.addEventListener('click', function () {
      askDeleteAndBan('글 삭제', '"' + p.title + '" 글을 삭제합니다. 댓글도 함께 사라집니다.', p.author, function () {
        if (SEED_POSTS.some(function (s) { return s.id === p.id; })) { removed = removed.concat(p.id); save('zip-posts-removed', removed); }
        posts = posts.filter(function (x) { return x.id !== p.id; });
        savePosts();
      });
    });
    act.appendChild(del); tr.appendChild(act);
    body.appendChild(tr);

    if (openId === p.id) {
      var dr = el('tr', 'detail'), dc = el('td'); dc.colSpan = 9;
      dc.appendChild(el('div', 'detail-body', p.body));
      (p.comments || []).forEach(function (cm) {
        var row = el('div', 'cmt-row');
        row.appendChild(el('b', null, cm.author));
        row.appendChild(el('span', null, cm.text));
        var cd = el('button', 'btn danger', '댓글 삭제'); cd.type = 'button';
        cd.addEventListener('click', function () {
          askDeleteAndBan('댓글 삭제', '이 댓글을 삭제합니다.', cm.author, function () {
            p.comments.splice(p.comments.indexOf(cm), 1); savePosts();
          });
        });
        row.appendChild(cd); dc.appendChild(row);
      });
      if (!(p.comments || []).length) dc.appendChild(el('div', 'hint', '댓글이 없습니다.'));
      dr.appendChild(dc); body.appendChild(dr);
    }
  });
}

function renderAll() {
  reload(); renderStats(); fillFilters();
  $('paneMembers').hidden = tab !== 'members';
  $('panePosts').hidden = tab !== 'posts';
  document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === tab); });
  if (tab === 'members') renderMembers(); else renderPosts();
}

document.querySelectorAll('#tabs button').forEach(function (b) {
  b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); renderAll(); });
});
['mSearch', 'mStatus', 'mMinBans', 'mMinWarns', 'mSort'].forEach(function (id) { $(id).addEventListener('input', renderMembers); });
['pSearch', 'pCat', 'pRegion'].forEach(function (id) { $(id).addEventListener('input', renderPosts); });

// 맨 위 체크박스: 지금 검색 결과 전체 선택/해제
$('mAll').addEventListener('change', function () {
  var on = $('mAll').checked;
  filteredMembers().forEach(function (m) { selected[m.nick] = on; });
  renderMembers();
});
$('bulkClear').addEventListener('click', function () { selected = {}; renderMembers(); });
// 선택한 회원 일괄 정지 (이미 영구 정지 중인 사람은 건너뜀)
$('bulkBan').addEventListener('click', function () {
  var targets = selectedNicks().filter(function (n) { return !(isBanned(n) && bans[n].perm); });
  if (!targets.length) { alert('정지할 수 있는 회원이 없습니다. (이미 영구 정지 중)'); return; }
  dialog({ title: '선택한 ' + targets.length + '명 정지', msg: '선택한 회원 모두에게 같은 기간으로 정지를 겁니다. 각자 정지 횟수가 1회씩 늘어납니다.' , okText: '일괄 정지', defaultPerm: true }).then(function (r) {
    if (!r) return;
    targets.forEach(function (n) { act(n, r.days, r.reason); });
    selected = {}; renderAll();
  });
});
$('bulkUnban').addEventListener('click', function () {
  selectedNicks().forEach(function (n) { Ban.unban(n); });
  selected = {}; renderAll();
});
window.addEventListener('focus', renderAll);   // 앱 화면에서 글을 쓰고 돌아오면 최신으로
renderAll();
