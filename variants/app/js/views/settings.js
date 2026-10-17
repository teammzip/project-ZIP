/* 설정(내 정보): 이름, 동네, 월세, 알림, 데이터 초기화 */
import { $ } from '../core/utils.js';
import { store, clearAll } from '../core/storage.js';
import { settings } from '../core/state.js';
import { registerView } from '../core/router.js';
import { applySettings } from '../components/shell.js';

function fillSettings() {
  $('setName').value = settings.name;
  $('setRegion').value = settings.region;
  $('setRentDay').value = settings.rentDay;
  $('setRent').value = settings.rent;
  $('setNoti').checked = settings.notiOn;
  $('setSaved').textContent = '';
}
$('setForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var name = $('setName').value.trim();
  if (!name) return;
  settings.name = name;
  settings.region = $('setRegion').value.trim();
  settings.rentDay = Math.min(31, Math.max(1, Number($('setRentDay').value) || 15));
  settings.rent = Math.max(0, Number($('setRent').value) || 0);
  settings.notiOn = $('setNoti').checked;
  store('zip-settings', settings);
  applySettings();
  $('setSaved').textContent = '저장됐어요.';
  setTimeout(function () { $('setSaved').textContent = ''; }, 2000);
});
$('btnReset').addEventListener('click', function () {
  if (!confirm('일정, 할 일, 가계부(수입·지출), 알림 상태, 커뮤니티 글, AI 대화, 설정이 모두 삭제됩니다. 계속할까요?')) return;
  clearAll();
  location.reload();
});

registerView('settings', fillSettings);
