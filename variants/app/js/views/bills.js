/* 공과금: 홈 카드, 상세 화면 */
import { $, el, today, won } from '../core/utils.js';
import { store } from '../core/storage.js';
import { state } from '../core/state.js';
import { registerView } from '../core/router.js';

// 공과금 목록을 저장하고 화면을 다시 그림 (체크·삭제·추가 때마다 호출)
function saveBills() { store('zip-bills', state.bills); renderBills(); }

// 홈 "이번 달 공과금" 카드(납부율·막대)와 공과금 상세 화면(합계·납부·남음·항목 목록)을 한 번에 그림
export function renderBills() {
  var total = 0, paid = 0;
  state.bills.forEach(function (b) { total += b.amount; if (b.paid) paid += b.amount; });
  var pct = total ? Math.round(paid / total * 100) : 0;
  var paidNames = state.bills.filter(function (b) { return b.paid; }).map(function (b) { return b.name; });
  var leftNames = state.bills.filter(function (b) { return !b.paid; }).map(function (b) { return b.name; });
  $('billPct').textContent = pct;
  $('billBar').style.width = pct + '%';
  var parts = [];
  if (paidNames.length) parts.push(paidNames.join(' · ') + ' 납부 완료');
  if (leftNames.length) parts.push(leftNames.join(' · ') + ' 남음');
  $('billSub').textContent = parts.length ? parts.join(', ') : '공과금 항목을 추가해 보세요';
  $('billTitle').textContent = (today.getMonth() + 1) + '월 공과금';
  $('billTotal').textContent = won(total); $('billPaid').textContent = won(paid); $('billLeft').textContent = won(total - paid);
  $('billBar2').style.width = pct + '%';
  var box = $('billList'); box.textContent = '';
  state.bills.forEach(function (b) {
    var row = el('div', 'bill' + (b.paid ? ' paid' : ''));
    var cb = el('input'); cb.type = 'checkbox'; cb.checked = b.paid; cb.setAttribute('aria-label', b.name + ' 납부');
    cb.addEventListener('change', function () { b.paid = cb.checked; saveBills(); });
    var nm = el('div', 'nm');
    nm.appendChild(el('b', null, b.name));
    nm.appendChild(el('small', null, won(b.amount) + (b.paid ? ' · 납부 완료' : ' · 미납')));
    var del = el('button', 'del', '×'); del.type = 'button'; del.title = '삭제';
    del.addEventListener('click', function () { state.bills = state.bills.filter(function (x) { return x.id !== b.id; }); saveBills(); });
    row.appendChild(cb); row.appendChild(nm); row.appendChild(del);
    box.appendChild(row);
  });
  if (!state.bills.length) box.appendChild(el('div', 'empty', '등록된 공과금이 없어요.'));
}
// 공과금 항목 추가 폼: 이름과 금액을 받아 "미납" 상태로 목록에 더함
$('billForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var name = $('billName').value.trim(), amt = Math.max(0, Number($('billAmount').value) || 0);
  if (!name) return;
  state.bills.push({ id: Date.now(), name: name, amount: amt, paid: false });
  $('billName').value = ''; $('billAmount').value = '';
  saveBills();
});
// "새 달 시작" 버튼: 모든 항목을 다시 미납으로 되돌림
$('billReset').addEventListener('click', function () {
  state.bills.forEach(function (b) { b.paid = false; });
  saveBills();
});

registerView('bills', renderBills);
