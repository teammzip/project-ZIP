/* 지도: OpenStreetMap iframe + 주변 장소 목록 + AI 장소 찾기 + 즐겨찾기 + 카테고리 편집
 * - 장소 데이터는 data/places.js 의 예시 (실제 서비스에서는 지도 검색 API 로 대체)
 * - 즐겨찾기(zip-fav-places): 장소 번호("종류:이름") 목록
 * - 보여 줄 종류(zip-map-cats): { on: [켜 둔 종류], custom: [직접 추가한 검색어] } */
import { $, el } from '../core/utils.js';
import { load, store } from '../core/storage.js';
import { settings } from '../core/state.js';
import { PLACES, DEFAULT_CATS, CAT_ICON, allPlaces, walkMin } from '../data/places.js';
import { registerView } from '../core/router.js';

var FAV = '__fav';          // 칩 "즐겨찾기"를 가리키는 값
var CUSTOM = 'c:';          // 직접 추가한 검색어 칩의 값 앞머리 ("c:카페")

// 저장된 설정 (없거나 깨졌으면 기본값)
var cats = load('zip-map-cats', null);
if (!cats || !Array.isArray(cats.on)) cats = { on: DEFAULT_CATS.slice(), custom: [] };
cats.on = cats.on.filter(function (c) { return PLACES[c]; });
if (!Array.isArray(cats.custom)) cats.custom = [];
var favs = load('zip-fav-places', []);
if (!Array.isArray(favs)) favs = [];
function saveCats() { store('zip-map-cats', cats); }
function saveFavs() { store('zip-fav-places', favs); }

// 지금 보는 칩, 고른 장소 번호, 지도를 이미 열었는지, AI 찾기 결과, 편집 창이 열려 있는지
var mapCat = cats.on[0] || FAV, selId = null, mapReady = false, aiOut = null, editing = false;

var ALL = allPlaces();
function byId(id) { return ALL.filter(function (p) { return p.id === id; })[0] || null; }
function isFav(id) { return favs.indexOf(id) >= 0; }
function toggleFav(id) { favs = isFav(id) ? favs.filter(function (x) { return x !== id; }) : favs.concat(id); saveFavs(); }

// 지금 칩에 해당하는 장소 목록
function listFor(cat) {
  if (cat === FAV) return ALL.filter(function (p) { return isFav(p.id); }).sort(function (a, b) { return walkMin(a) - walkMin(b); });
  if (cat.indexOf(CUSTOM) === 0) {
    var kw = cat.slice(CUSTOM.length);
    return ALL.filter(function (p) { return (p.n + p.d + p.cat).indexOf(kw) >= 0; });
  }
  return ALL.filter(function (p) { return p.cat === cat; });
}

// 고른 장소 주변의 OpenStreetMap 을 지도 칸에 표시하고 "크게 보기" 링크도 맞춤
function setMap(p) {
  var b = [p.lon - 0.004, p.lat - 0.0025, p.lon + 0.004, p.lat + 0.0025].join('%2C');
  $('mapFrame').src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + b + '&layer=mapnik&marker=' + p.lat + '%2C' + p.lon;
  $('mapBig').href = 'https://www.openstreetmap.org/?mlat=' + p.lat + '&mlon=' + p.lon + '#map=17/' + p.lat + '/' + p.lon;
}
// 장소를 고름: 칩(종류)을 맞추고 지도를 그 위치로
function selectPlace(p, switchCat) {
  if (switchCat) {
    if (cats.on.indexOf(p.cat) < 0) { cats.on.push(p.cat); saveCats(); }
    mapCat = p.cat;
  }
  selId = p.id;
  renderPlaces();
  setMap(p);
}

// ---------- AI 장소 찾기 (시연용: 예시 데이터 안에서 말을 읽어 고름) ----------
// 말 → 찾을 장소 종류
var SYN = [
  [/빨래|세탁|이불|건조/, ['세탁방', '세탁소']],
  [/편의점|야식|간식|담배|새벽/, ['편의점']],
  [/약|감기|두통|소화|밴드/, ['약국']],
  [/아파|아프|병원|진료|치과|내과|열|소아/, ['병원', '약국']],
  [/장보|식재료|마트|채소|과일/, ['마트', '반찬가게']],
  [/커피|카페|공부|스터디|작업|노트북/, ['카페']],
  [/운동|헬스|요가|조깅|PT/i, ['헬스장', '공원']],
  [/돈|출금|입금|은행|atm/i, ['은행']],
  [/머리|커트|미용|파마/, ['미용실']],
  [/생활용품|다이소|수납|청소용품|잡화/, ['다이소', '마트']],
  [/밥|식당|혼밥|먹|배고|점심|저녁|국밥|분식/, ['식당', '반찬가게']],
  [/반찬/, ['반찬가게']],
  [/전입|주민|서류|등본|민원/, ['주민센터']],
  [/공원|산책|걷|벤치/, ['공원']],
  [/수선|드라이|옷/, ['세탁소']]
];
// 말 → 원하는 조건 (조건 글자가 장소 설명에 있으면 점수를 더함)
var MODS = [
  { re: /24|밤|심야|새벽|야간|늦게/, has: /24시간|심야|야간/, label: '24시간·심야 운영', w: 3 },
  { re: /싼|저렴|가성비|값/, has: /저렴|월 3만원/, label: '저렴함', w: 2 },
  { re: /조용|한적|스터디|콘센트/, has: /조용|스터디|콘센트/, label: '조용함', w: 2 },
  { re: /혼밥|혼자/, has: /혼밥/, label: '혼밥하기 좋음', w: 2 },
  { re: /주말|토요일/, has: /토요일|주말/, label: '주말 이용', w: 2 }
];
function aiFind(q) {
  var s = q.replace(/\s/g, '');
  var wantCats = [];
  SYN.forEach(function (x) { if (x[0].test(s)) x[1].forEach(function (c) { if (wantCats.indexOf(c) < 0) wantCats.push(c); }); });
  Object.keys(PLACES).forEach(function (c) { if (s.indexOf(c) >= 0 && wantCats.indexOf(c) < 0) wantCats.push(c); });   // 종류 이름을 그대로 쓴 경우
  var mods = MODS.filter(function (m) { return m.re.test(s); });
  var tokens = q.split(/[\s,]+/).map(function (t) { return t.replace(/(이나|에서|근처|주변|가까운|제일|있는|찾아줘|알려줘|어디|있어|싶어|해줘|좀)$/, ''); }).filter(function (t) { return t.length >= 2; });
  var res = [];
  ALL.forEach(function (p) {
    var score = 0, why = [];
    if (wantCats.indexOf(p.cat) >= 0) { score += 5; why.push(p.cat); }
    tokens.forEach(function (t) { if ((p.n + p.d).indexOf(t) >= 0) { score += 3; if (why.indexOf('"' + t + '" 포함') < 0) why.push('"' + t + '" 포함'); } });
    mods.forEach(function (m) { if (m.has.test(p.d)) { score += m.w; why.push(m.label); } });
    if (score >= 3) { score += (20 - Math.min(walkMin(p), 20)) / 20; res.push({ p: p, score: score, why: why }); }
  });
  res.sort(function (a, b) { return b.score - a.score; });
  return res.slice(0, 5);
}
function renderAiOut() {
  var box = $('aiFindOut'); box.textContent = '';
  if (!aiOut) return;
  var wrap = el('div', 'ai-out');
  var head = el('div', 'ai-out-head');
  var where = settings.region ? settings.region + ' 집 근처에서 ' : '집 근처에서 ';
  head.appendChild(el('span', null, aiOut.items.length ? '"' + aiOut.q + '" → ' + where + '가까운 순으로 ' + aiOut.items.length + '곳을 골랐어요.' : '"' + aiOut.q + '" 에 맞는 곳을 못 찾았어요. 다른 말로 물어보거나 "카테고리 편집"에서 종류를 추가해 보세요.'));
  var x = el('button', 'ai-out-x', '✕'); x.type = 'button'; x.title = '결과 닫기';
  x.addEventListener('click', function () { aiOut = null; renderAiOut(); });
  head.appendChild(x);
  wrap.appendChild(head);
  aiOut.items.forEach(function (r) {
    var row = el('div', 'place' + (r.p.id === selId ? ' on' : ''));
    var t = el('div', 'place-main');
    t.appendChild(el('b', null, (CAT_ICON[r.p.cat] || '📍') + ' ' + r.p.n));
    t.appendChild(el('small', null, r.p.d));
    t.appendChild(el('small', 'why', '추천 이유: ' + r.why.concat('도보 ' + (walkMin(r.p) < 99 ? walkMin(r.p) + '분' : '정보 없음')).join(' · ')));
    row.appendChild(t);
    row.appendChild(starBtn(r.p));
    row.addEventListener('click', function () { selectPlace(r.p, true); renderAiOut(); });
    wrap.appendChild(row);
  });
  wrap.appendChild(el('p', 'map-note', 'AI 찾기는 시연용이에요. 예시 데이터 안에서 말을 읽어 고르고, 실제 서비스에서는 AI와 지도 검색 API가 근처 장소를 찾아 줘요.'));
  box.appendChild(wrap);
}

// ---------- 목록 그리기 ----------
// 즐겨찾기 별 버튼
function starBtn(p) {
  var b = el('button', 'star' + (isFav(p.id) ? ' on' : ''), isFav(p.id) ? '★' : '☆');
  b.type = 'button'; b.title = isFav(p.id) ? '즐겨찾기 해제' : '즐겨찾기에 추가';
  b.addEventListener('click', function (e) { e.stopPropagation(); toggleFav(p.id); renderPlaces(); renderAiOut(); });
  return b;
}
// 칩, (열려 있으면) 카테고리 편집 창, 장소 목록
function renderPlaces() {
  var chips = $('mapChips'); chips.textContent = '';
  function chip(label, val) {
    var b = el('button', 'chip' + (val === mapCat ? ' on' : ''), label);
    b.type = 'button';
    b.addEventListener('click', function () { mapCat = val; var l = listFor(val); selId = l[0] ? l[0].id : null; renderPlaces(); if (l[0]) setMap(l[0]); });
    chips.appendChild(b);
  }
  chip('★ 즐겨찾기 ' + favs.length, FAV);
  cats.on.forEach(function (c) { chip((CAT_ICON[c] || '📍') + ' ' + c, c); });
  cats.custom.forEach(function (k) { chip('🔎 ' + k, CUSTOM + k); });

  $('catEditor').hidden = !editing;
  $('catEdit').textContent = editing ? '편집 닫기' : '카테고리 편집';
  if (editing) renderEditor();

  var box = $('placeList'); box.textContent = '';
  var list = listFor(mapCat);
  if (!list.length) {
    box.appendChild(el('div', 'empty', mapCat === FAV ? '아직 즐겨찾기한 장소가 없어요. 장소 오른쪽의 ☆를 눌러 보세요.' : '예시 데이터에는 이 조건의 장소가 없어요. 실제 서비스에서는 지도 검색으로 찾아와요.'));
    return;
  }
  list.forEach(function (p) {
    var row = el('div', 'place' + (p.id === selId ? ' on' : ''));
    var t = el('div', 'place-main');
    t.appendChild(el('b', null, p.n));
    t.appendChild(el('small', null, (mapCat === FAV || mapCat.indexOf(CUSTOM) === 0 ? p.cat + ' · ' : '') + p.d));
    row.appendChild(t);
    row.appendChild(starBtn(p));
    row.addEventListener('click', function () { selectPlace(p, false); });
    box.appendChild(row);
  });
}
// 카테고리 편집 창: 종류 켜기/끄기, 직접 검색어 추가, 기본값으로 되돌리기
function renderEditor() {
  var box = $('catEditor'); box.textContent = '';
  box.appendChild(el('p', 'map-note', '보고 싶은 장소 종류를 눌러 켜고 끄세요. (✓ 표시 = 지금 보이는 종류)'));
  var chips = el('div', 'chips');
  Object.keys(PLACES).forEach(function (c) {
    var on = cats.on.indexOf(c) >= 0;
    var b = el('button', 'chip' + (on ? ' on' : ''), (on ? '✓ ' : '') + (CAT_ICON[c] || '📍') + ' ' + c + ' ' + PLACES[c].length);
    b.type = 'button';
    b.addEventListener('click', function () {
      cats.on = on ? cats.on.filter(function (x) { return x !== c; }) : cats.on.concat(c);
      if (on && mapCat === c) { mapCat = cats.on[0] || FAV; var l = listFor(mapCat); selId = l[0] ? l[0].id : null; }
      saveCats(); renderPlaces();
    });
    chips.appendChild(b);
  });
  box.appendChild(chips);
  var f = el('form', 'cat-add');
  var inp = el('input'); inp.type = 'text'; inp.id = 'catCustom'; inp.maxLength = 12; inp.placeholder = '직접 추가 (예: 빵집, 고시원)';
  var add = el('button', 'btn-line', '추가'); add.type = 'submit';
  f.appendChild(inp); f.appendChild(add);
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var k = inp.value.trim();
    if (!k || cats.custom.indexOf(k) >= 0 || Object.keys(PLACES).indexOf(k) >= 0) { inp.value = ''; return; }
    cats.custom.push(k); saveCats(); mapCat = CUSTOM + k; selId = null; renderPlaces();
  });
  box.appendChild(f);
  if (cats.custom.length) {
    var cl = el('div', 'chips');
    cats.custom.forEach(function (k) {
      var b = el('button', 'chip', '🔎 ' + k + ' ✕'); b.type = 'button'; b.title = '이 검색어 칩 지우기';
      b.addEventListener('click', function () {
        cats.custom = cats.custom.filter(function (x) { return x !== k; });
        if (mapCat === CUSTOM + k) mapCat = cats.on[0] || FAV;
        saveCats(); renderPlaces();
      });
      cl.appendChild(b);
    });
    box.appendChild(cl);
  }
  var reset = el('button', 'btn-line', '기본(세탁방·편의점·약국·마트)으로 되돌리기'); reset.type = 'button';
  reset.addEventListener('click', function () { cats = { on: DEFAULT_CATS.slice(), custom: [] }; mapCat = cats.on[0]; selId = null; saveCats(); renderPlaces(); });
  box.appendChild(reset);
}

// 화면 이벤트 연결 (한 번만)
$('catEdit').addEventListener('click', function () { editing = !editing; renderPlaces(); });
$('aiFindForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var q = $('aiFindQ').value.trim();
  if (!q) return;
  aiOut = { q: q, items: aiFind(q) };
  renderAiOut();
  if (aiOut.items[0]) selectPlace(aiOut.items[0].p, true), renderAiOut();   // 가장 잘 맞는 곳을 지도에 바로 표시
});
[].forEach.call(document.querySelectorAll('#aiFindEx button'), function (b) {
  b.addEventListener('click', function () { $('aiFindQ').value = b.textContent; $('aiFindForm').dispatchEvent(new Event('submit', { cancelable: true })); });
});

// 지도 화면을 처음 열 때 첫 장소를 표시
function initMap() {
  var list = listFor(mapCat);
  if (!selId && list[0]) selId = list[0].id;
  renderPlaces(); renderAiOut();
  if (!mapReady) { mapReady = true; var p = byId(selId); if (p) setMap(p); }
}

/* AI 화면의 "지도에서 보기"가 쓴다: 다음에 지도를 열 때 이 종류의 첫 장소로 시작 (꺼져 있던 종류면 켬) */
export function focusCategory(key) {
  if (PLACES[key] && cats.on.indexOf(key) < 0) { cats.on.push(key); saveCats(); }
  mapCat = key; selId = null; mapReady = false;
}

registerView('map', initMap);
