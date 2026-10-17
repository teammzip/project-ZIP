/* 쓰레기 배출: 홈 카드, 오른쪽 패널의 배출 줄, 상세 화면 */
import { $, el, today } from '../core/utils.js';
import { TRASH, DOW, trashIco } from '../data/trash.js';
import { registerView } from '../core/router.js';

export function renderTrash() {
  var td = TRASH[today.getDay()];
  $('trashToday').textContent = td ? '오늘은 ' + td.t : '오늘은 배출 없음';
  $('trashSub').textContent = td ? td.d : '내일 배출을 준비하세요';
  var box = $('trashBox'); box.textContent = '';
  box.appendChild(el('b', null, td ? td.t : '배출 없음'));
  box.appendChild(document.createTextNode(td ? td.d : '오늘은 배출하는 날이 아니에요. 쓰레기는 모아 두세요.'));
  var wk = $('trashWeek'); wk.textContent = '';
  TRASH.forEach(function (x, i) {
    var row = el('div', 'week-row' + (i === today.getDay() ? ' today' : ''));
    row.appendChild(el('span', 'dw', DOW[i]));
    var it = el('div', 'it');
    it.appendChild(document.createTextNode(x ? x.t : '배출 없음'));
    if (x) it.appendChild(el('small', null, x.d));
    row.appendChild(it);
    if (i === today.getDay()) row.appendChild(el('span', 'tag warn', '오늘'));
    wk.appendChild(row);
  });

  // 오른쪽 패널 "다가오는 알림": 오늘 배출 + 다음 재활용 요일
  $('pTrashIco').textContent = td ? trashIco(td.t) : '🗑️';
  $('pTrashT').textContent = td ? td.t + ' 배출' : '오늘은 배출 없음';
  $('pTrashS').textContent = td ? '오늘 ' + td.d : '쓰레기는 모아 두세요';
  var nextR = null;
  for (var k = 1; k <= 7; k++) {
    var idx = (today.getDay() + k) % 7;
    if (TRASH[idx] && TRASH[idx].t === '재활용') { nextR = { k: k, idx: idx }; break; }
  }
  $('pRecyS').textContent = nextR ? TRASH[nextR.idx].d : '배출 일정 없음';
  $('pRecyTime').textContent = nextR ? (nextR.k === 1 ? '내일' : DOW[nextR.idx] + '요일') : '';
}

registerView('trash', renderTrash);
