/* 홈 맨 위 알림 회전창: 알림 개수만큼 슬라이드가 돌아가고, 닫기(×)를 누르면 하나씩 사라지며 다 닫으면 이 부분이 통째로 없어진다.
 * - 알림 내용은 알림 화면과 같은 목록(views/noti.js 의 buildNotis)을 쓴다.
 * - 닫은 알림은 그날 하루 동안 기억한다(zip-home-noti-closed). 다음 날이 되면 다시 나오고, 알림을 끈 설정이면 아예 안 보인다.
 * - 이 창은 홈의 "사진으로 생활 고민을 물어보세요" 카드 안에 있다(월세 납부일 카드 옆). 알림이 없으면 창만 사라지고 카드는 남는다.
 * - 일정이 바뀌거나 설정을 저장하면(noti.js 의 updateDot) 'zip:noti' 신호를 받아 다시 그린다. */
import { $, el, todayStr } from '../core/utils.js';
import { load, store } from '../core/storage.js';
import { settings } from '../core/state.js';
import { buildNotis } from '../views/noti.js';
import { showView } from '../core/router.js';

var KEY = 'zip-home-noti-closed';
var AUTO_MS = 4500;                 // 자동으로 다음 알림으로 넘어가는 간격
var idx = 0, timer = null, hovering = false;

// 오늘 닫은 알림 번호 목록 (날짜가 바뀌면 비움)
function closedIds() { var c = load(KEY, null); return c && c.date === todayStr && Array.isArray(c.ids) ? c.ids : []; }
function close(id) { var ids = closedIds(); if (ids.indexOf(id) < 0) ids.push(id); store(KEY, { date: todayStr, ids: ids }); }
// 보여줄 알림 = 전체 알림 중 오늘 닫지 않은 것
function visibleNotis() {
  if (!settings.notiOn) return [];
  var closed = closedIds();
  return buildNotis().filter(function (n) { return closed.indexOf(n.id) < 0; });
}

function stop() { if (timer) { clearInterval(timer); timer = null; } }
function start(n) {
  stop();
  if (n < 2 || hovering || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  timer = setInterval(function () { go(idx + 1); }, AUTO_MS);
}
// idx 번째 슬라이드로 (끝에서 처음으로 돌아옴)
function go(i) {
  var n = $('hnTrack').children.length;
  if (!n) return;
  idx = (i + n) % n;
  $('hnTrack').style.transform = 'translateX(' + (-idx * 100) + '%)';
  [].forEach.call($('hnDots').children, function (d, k) { d.classList.toggle('on', k === idx); });
  $('hnCount').textContent = (idx + 1) + ' / ' + n;
}

export function renderHomeNoti() {
  var list = visibleNotis(), box = $('homeNoti');
  box.hidden = !list.length;               // 다 닫았거나 알림이 없으면 이 부분이 없어짐
  if (!list.length) { stop(); return; }
  var track = $('hnTrack'), dots = $('hnDots');
  track.textContent = ''; dots.textContent = '';
  list.forEach(function (n, k) {
    var slide = el('div', 'hn-slide');
    slide.appendChild(el('div', 'ico', n.ico));
    var t = el('div', 't');
    t.appendChild(el('b', null, n.t));
    t.appendChild(el('small', null, n.s));
    slide.appendChild(t);
    slide.appendChild(el('span', 'badge', n.time));
    var x = el('button', 'hn-close', '닫기'); x.type = 'button'; x.setAttribute('aria-label', n.t + ' 알림 닫기');
    x.addEventListener('click', function () { close(n.id); idx = Math.min(idx, Math.max(list.length - 2, 0)); renderHomeNoti(); });
    slide.appendChild(x);
    track.appendChild(slide);
    var d = el('button', 'hn-dot'); d.type = 'button'; d.setAttribute('aria-label', (k + 1) + '번째 알림');
    d.addEventListener('click', function () { go(k); start(list.length); });
    dots.appendChild(d);
  });
  $('hnPrev').hidden = $('hnNext').hidden = dots.hidden = list.length < 2;
  go(Math.min(idx, list.length - 1));
  start(list.length);
}

$('hnPrev').addEventListener('click', function () { go(idx - 1); start($('hnTrack').children.length); });
$('hnNext').addEventListener('click', function () { go(idx + 1); start($('hnTrack').children.length); });
$('homeNoti').addEventListener('mouseenter', function () { hovering = true; stop(); });
$('homeNoti').addEventListener('mouseleave', function () { hovering = false; start($('hnTrack').children.length); });
$('hnAll').addEventListener('click', function (e) { e.preventDefault(); showView('noti'); });
document.addEventListener('zip:noti', renderHomeNoti);   // noti.js 의 updateDot 이 보냄
