/* 알림 화면 + 빨간 점 */
import { $, el, fmt, todayStr, today, dayDiff, sortEvents } from '../core/utils.js';
import { store } from '../core/storage.js';
import { state, settings, readMap } from '../core/state.js';
import { nextRentDate } from '../core/rentdate.js';
import { TRASH, trashIco } from '../data/trash.js';
import { registerView } from '../core/router.js';

// 알림 화면의 보기 방식: all(전체) 또는 unread(안 읽음)
var notiMode = 'all';

// 지금 보여줄 알림 목록을 만듦: 3일 안 일정, 오늘 쓰레기 배출, 월세 D-day, 예시 알림(냉장고·댓글)
function buildNotis() {
  var list = [];
  sortEvents(state.events).forEach(function (ev) {
    var diff = dayDiff(ev.date);
    if (diff < 0 || diff > 3) return;
    list.push({ id: 'ev-' + ev.id, ico: '📌', t: ev.title, s: ev.date.slice(5).replace('-', '월 ') + '일 ' + (ev.time || '종일'), time: diff === 0 ? '오늘' : 'D-' + diff });
  });
  var rd = nextRentDate(), rdiff = dayDiff(fmt(rd));
  var td = TRASH[today.getDay()];
  list.push(
    td ? { id: 'trash-' + todayStr, ico: trashIco(td.t), t: '오늘은 ' + td.t + ' 배출일이에요', s: td.d, time: '오늘' }
      : { id: 'trash-' + todayStr, ico: '🗑️', t: '오늘은 쓰레기 배출이 없어요', s: '쓰레기는 모아 두세요', time: '오늘' },
    { id: 'n2', ico: '💸', t: '월세 납부일이 ' + (rdiff === 0 ? '오늘이에요' : rdiff + '일 남았어요'), s: '매월 ' + settings.rentDay + '일 · ' + settings.rent + '만원', time: '1시간 전' },
    { id: 'n3', ico: '🧊', t: '냉장고 재료 3개가 곧 만료돼요', s: '두부 · 방울토마토 · 우유', time: '오늘' },
    { id: 'n4', ico: '💬', t: '커뮤니티에 새 댓글이 달렸어요', s: '쓰레기 배출 시간 바뀐 건가요?', time: '어제' }
  );
  return list;
}
// 안 읽은 알림 개수
function unreadCount() { return buildNotis().filter(function (n) { return !readMap[n.id]; }).length; }
// 안 읽은 알림이 있으면 메뉴·상단 종·마이페이지 탭의 빨간 점을 보이고, 없거나 알림을 껐으면 숨김
export function updateDot() { var off = !(settings.notiOn && unreadCount() > 0); $('navDot').hidden = off; $('bellDot').hidden = off; $('myNotiDot').hidden = off; }

// 알림 화면을 그림: 알림을 누르면 읽음 처리(zip-noti-read에 저장)
function renderNotiCenter() {
  var box = $('notiCenter');
  box.textContent = '';
  $('notiOffNotice').hidden = settings.notiOn;
  var all = buildNotis();
  var items = notiMode === 'unread' ? all.filter(function (n) { return !readMap[n.id]; }) : all;
  var cnt = unreadCount();
  $('notiCount').hidden = cnt === 0;
  $('notiCount').textContent = cnt + '개 안 읽음';
  $('nAll').classList.toggle('on', notiMode === 'all');
  $('nUnread').classList.toggle('on', notiMode === 'unread');
  if (!items.length) { box.appendChild(el('div', 'empty', '알림이 없어요.')); return; }
  items.forEach(function (n) {
    var row = el('div', 'noti clickable' + (readMap[n.id] ? '' : ' unread'));
    row.appendChild(el('div', 'ico', n.ico));
    var t = el('div', 't');
    t.appendChild(el('b', null, n.t));
    t.appendChild(el('small', null, n.s + ' · ' + n.time));
    row.appendChild(t);
    if (!readMap[n.id]) row.appendChild(el('span', 'udot'));
    row.addEventListener('click', function () {
      readMap[n.id] = true; store('zip-noti-read', readMap);
      renderNotiCenter(); updateDot();
    });
    box.appendChild(row);
  });
}
// 알림 화면의 "전체 / 안 읽음 / 모두 읽음" 버튼
$('nAll').addEventListener('click', function () { notiMode = 'all'; renderNotiCenter(); });
$('nUnread').addEventListener('click', function () { notiMode = 'unread'; renderNotiCenter(); });
$('nReadAll').addEventListener('click', function () {
  buildNotis().forEach(function (n) { readMap[n.id] = true; });
  store('zip-noti-read', readMap); renderNotiCenter(); updateDot();
});

registerView('noti', renderNotiCenter);
