/* 월세: 홈 카드, 오른쪽 패널의 월세 줄, 상세 화면 */
import { $, el, pad, fmt, today, dayDiff } from '../core/utils.js';
import { store } from '../core/storage.js';
import { state, settings, rentPaid } from '../core/state.js';
import { nextRentDate } from '../core/rentdate.js';
import { DOW } from '../data/trash.js';
import { registerView } from '../core/router.js';
import { updateDot } from './noti.js';

// 월별 납부 기록의 키 (예: 2026-10)
function rentKey(y, m) { return y + '-' + pad(m + 1); }

/* 홈의 월세 카드 + 오른쪽 패널의 월세 줄 */
export function renderRentSummary() {
  var c = nextRentDate();
  var diff = dayDiff(fmt(c));
  $('rentDday').textContent = diff === 0 ? 'D-Day' : 'D-' + diff;
  $('rentSub').textContent = '매월 ' + settings.rentDay + '일 · ' + settings.rent + '만원 · 계좌이체' + (rentPaid[rentKey(c.getFullYear(), c.getMonth())] ? ' · 납부 완료' : '');
  $('pRentSub').textContent = settings.rent + '만원 · 이체';
  $('pRentTime').textContent = (c.getMonth() + 1) + '/' + c.getDate();
}

// 월세 상세 화면: D-day, 납부 예정일, 금액, 최근 6개월 납부 체크 목록
function renderRent() {
  var c = nextRentDate(), diff = dayDiff(fmt(c));
  $('rentBig').textContent = diff === 0 ? 'D-Day' : 'D-' + diff;
  $('rentDate').textContent = c.getFullYear() + '년 ' + (c.getMonth() + 1) + '월 ' + c.getDate() + '일 (' + DOW[c.getDay()] + ')';
  $('rentAmt').textContent = settings.rent + '만원';
  $('rentDayTxt').textContent = '매월 ' + settings.rentDay + '일';
  var box = $('rentHistory'); box.textContent = '';
  for (var i = 0; i < 6; i++) {
    var d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    var key = rentKey(d.getFullYear(), d.getMonth());
    var row = el('label', 'rent-row');
    var cb = el('input'); cb.type = 'checkbox'; cb.checked = !!rentPaid[key];
    (function (k, box2) {
      box2.addEventListener('change', function () { rentPaid[k] = box2.checked; store('zip-rent-paid', rentPaid); renderRentSummary(); renderRent(); });
    })(key, cb);
    row.appendChild(cb);
    row.appendChild(el('span', null, d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월'));
    row.appendChild(el('small', null, rentPaid[key] ? '납부 완료' : (i === 0 ? '이번 달 · 미납' : '미납')));
    box.appendChild(row);
  }
}
// "캘린더에 추가" 버튼: 다음 월세 납부일을 일정으로 등록 (이미 있으면 중복 등록하지 않음)
$('rentCal').addEventListener('click', function () {
  var c = nextRentDate(), ds = fmt(c);
  var msg = $('rentMsg');
  var exists = state.events.some(function (ev) { return ev.date === ds && ev.title === '월세 납부'; });
  if (!exists) {
    state.events.push({ id: Date.now(), date: ds, time: '', title: '월세 납부' });
    store('zip-events', state.events); updateDot();
  }
  msg.textContent = exists ? '이미 캘린더에 있어요.' : (c.getMonth() + 1) + '월 ' + c.getDate() + '일 일정으로 추가했어요.';
  setTimeout(function () { msg.textContent = ''; }, 2500);
});

registerView('rent', renderRent);
