/* 쓰레기 배출: 홈 카드와 오른쪽 패널 요약 */
import { $, today } from '../core/utils.js';
import { TRASH, DOW, trashIco } from '../data/trash.js';

// 오늘 배출 정보와 다음 배출 정보를 홈 카드 및 오른쪽 패널에 표시
export function renderTrash() {
  var td = TRASH[today.getDay()];
  $('trashToday').textContent = td ? '오늘은 ' + td.t : '오늘은 배출 없음';
  $('trashSub').textContent = td ? td.d : '내일 배출을 준비하세요';
  // 오른쪽 패널에는 가장 가까운 배출과 다음 재활용 일정을 표시
  var nextTrash = { k: 0, idx: today.getDay() };
  if (!TRASH[nextTrash.idx]) {
    for (var day = 1; day <= 7; day++) {
      var nextIdx = (today.getDay() + day) % 7;
      if (TRASH[nextIdx]) { nextTrash = { k: day, idx: nextIdx }; break; }
    }
  }
  var nextTrashData = TRASH[nextTrash.idx];
  if (!td) $('trashSub').textContent = '다음 배출은 ' + (nextTrash.k === 1 ? '내일' : DOW[nextTrash.idx] + '요일') + '이에요';
  $('pTrashIco').textContent = trashIco(nextTrashData.t);
  $('pTrashT').textContent = nextTrashData.t + ' 배출';
  $('pTrashS').textContent = nextTrash.k ? nextTrashData.d : '오늘 ' + nextTrashData.d;
  $('pTrashTime').textContent = nextTrash.k === 0 ? '오늘' : nextTrash.k === 1 ? '내일' : DOW[nextTrash.idx] + '요일';
  // 다음 재활용 배출 요일을 오늘부터 7일 안에서 찾음
  var nextR = null;
  for (var k = 1; k <= 7; k++) {
    var idx = (today.getDay() + k) % 7;
    if (TRASH[idx] && TRASH[idx].t === '재활용') { nextR = { k: k, idx: idx }; break; }
  }
  $('pRecyS').textContent = nextR ? TRASH[nextR.idx].d : '배출 일정 없음';
  $('pRecyTime').textContent = nextR ? (nextR.k === 1 ? '내일' : DOW[nextR.idx] + '요일') : '';
}
