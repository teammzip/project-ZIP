/* 고정 지출 합계: 월세 + 공과금 (월세·공과금을 합쳐 볼 때 맨 위에 표시) */
import { $ } from '../core/utils.js';
import { state, settings } from '../core/state.js';
import { registerView } from '../core/router.js';

function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }

export function renderFixed() {
  var rent = (Number(settings.rent) || 0) * 10000;                       // 월세는 만원 단위로 저장돼 있음
  var bills = 0, paid = 0;
  state.bills.forEach(function (b) { bills += b.amount; if (b.paid) paid += b.amount; });
  $('fixTotal').textContent = won(rent + bills);
  $('fixSub').textContent = '월세 ' + won(rent) + ' + 공과금 ' + won(bills);
  $('fixRent').textContent = won(rent);
  $('fixRentSub').textContent = '매달 ' + settings.rentDay + '일 납부';
  $('fixBills').textContent = won(bills);
  $('fixBillsSub').textContent = state.bills.length ? ('납부 ' + won(paid) + ' · 남음 ' + won(bills - paid)) : '등록된 항목이 없어요';
}

// 공과금 항목을 추가·삭제하거나 월세 금액을 바꾸면 합계도 자동으로 다시 계산 (각 화면의 표시가 바뀔 때를 지켜봄)
['billTotal', 'rentAmt'].forEach(function (id) {
  new MutationObserver(renderFixed).observe($(id), { childList: true, characterData: true, subtree: true });
});

registerView('fixed', renderFixed);
