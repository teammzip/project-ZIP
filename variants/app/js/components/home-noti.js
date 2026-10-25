/* 홈 맨 위 알림 칸: 알림이 세로로 쌓여 있고, 맨 위 알림의 닫기(×)를 누르면 그 알림이 옆으로 날아가며 아래 알림이 위로 올라온다.
 * 다 닫아도 칸(바탕)은 그대로 남고 안에 "새 알림이 없어요"가 보인다(닫은 알림 다시 보기 단추 포함). 칸 높이를 알림이 나눠 채우고, 칸에 다 못 들어가는 알림은 "+N개 더"로 보여 준다.
 * - 알림 내용은 알림 화면과 같은 목록(views/noti.js 의 buildNotis)을 쓴다.
 * - 닫은 알림은 그날 하루 동안 기억한다(zip-home-noti-closed). 다음 날이 되면 다시 나오고, 알림을 끈 설정이면 아예 안 보인다.
 * - 일정이 바뀌거나 설정을 저장하면(noti.js 의 updateDot) 'zip:noti' 신호를 받아 다시 그린다. */
import { $, el, todayStr } from '../core/utils.js';
import { load, store } from '../core/storage.js';
import { settings } from '../core/state.js';
import { buildNotis } from '../views/noti.js';
import { showView } from '../core/router.js';

var KEY = 'zip-home-noti-closed';

// 오늘 닫은 알림 번호 목록 (날짜가 바뀌면 비움)
function closedIds() { var c = load(KEY, null); return c && c.date === todayStr && Array.isArray(c.ids) ? c.ids : []; }
function close(id) { var ids = closedIds(); if (ids.indexOf(id) < 0) ids.push(id); store(KEY, { date: todayStr, ids: ids }); }
// 보여줄 알림 = 전체 알림 중 오늘 닫지 않은 것
function visibleNotis() {
  if (!settings.notiOn) return [];
  var closed = closedIds();
  return buildNotis().filter(function (n) { return closed.indexOf(n.id) < 0; });
}
// 한 번에 쌓아 보여 줄 알림 수: 3개 (나머지는 "+N개 더")
function maxShown() { return 3; }

export function renderHomeNoti() {
  var list = visibleNotis(), empty = !list.length;
  // 알림이 없어도 칸은 남기고 안내만 바꿈 (알림을 꺼 둔 경우와 다 닫은 경우를 나눠서 안내)
  $('hnEmpty').hidden = !empty;
  $('hnStack').hidden = empty;
  if (empty) {
    var off = !settings.notiOn;
    $('hnEmptyTitle').textContent = off ? '알림이 꺼져 있어요' : '새 알림이 없어요';
    $('hnEmptySub').textContent = off ? '내 정보에서 알림 받기를 켜 보세요.' : '알림이 생기면 여기에 쌓여요.';
    $('hnRestore').hidden = off || !closedIds().length;
    $('hnMore').hidden = true;
    $('hnCount').textContent = '';
    return;
  }
  var stack = $('hnStack'), shown = list.slice(0, maxShown());
  stack.textContent = '';
  shown.forEach(function (n) {
    var row = el('div', 'hn-row');
    row.appendChild(el('div', 'ico', n.ico));
    var t = el('div', 't');
    t.appendChild(el('b', null, n.t));
    t.appendChild(el('small', null, n.s));
    row.appendChild(t);
    row.appendChild(el('span', 'badge', n.time));
    var x = el('button', 'hn-close', '닫기'); x.type = 'button'; x.setAttribute('aria-label', n.t + ' 알림 닫기');
    x.addEventListener('click', function () {
      close(n.id);
      row.classList.add('out');             // 옆으로 날아간 뒤 지우고, 아래 알림이 올라오게 다시 그림
      setTimeout(renderHomeNoti, reduced() ? 0 : 320);
    });
    row.appendChild(x);
    stack.appendChild(row);
  });
  var more = list.length - shown.length;
  $('hnMore').hidden = more <= 0;
  $('hnMore').textContent = '+' + more + '개 더 있어요';
  $('hnCount').textContent = list.length + '개';
}
function reduced() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }

$('hnRestore').addEventListener('click', function () { store(KEY, { date: todayStr, ids: [] }); renderHomeNoti(); });   // 오늘 닫은 알림을 모두 되살림
$('hnAll').addEventListener('click', function (e) { e.preventDefault(); showView('noti'); });
$('hnMore').addEventListener('click', function () { showView('noti'); });
document.addEventListener('zip:noti', renderHomeNoti);   // noti.js 의 updateDot 이 보냄
window.addEventListener('resize', renderHomeNoti);       // 화면 폭이 바뀌면 보여 줄 개수도 바뀜
