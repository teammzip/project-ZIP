/* 설정(내 정보): 이름, 동네, 월세, 알림, 비밀번호 변경, 데이터 초기화 */
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
  resetPwForm();
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

/* 비밀번호 변경: 현재 비밀번호 확인 → 새 비밀번호를 두 번 입력 → 저장 (해시 저장은 shared/zip-password.js) */
function pwMsg(text, ok) { var m = $('pwMsg'); m.textContent = text; m.classList.toggle('ok', !!ok); m.classList.toggle('err', !ok && !!text); }
function resetPwForm() {
  ['pwCur', 'pwNew', 'pwNew2'].forEach(function (id) { $(id).value = ''; });
  $('pwShow').checked = false; setPwType(false);
  pwMsg('', true);
  $('pwDemo').hidden = !window.ZipPassword || window.ZipPassword.hasCustom();   // 가입으로 정한 비밀번호가 없으면 시안 기본 비밀번호를 안내
}
function setPwType(show) { ['pwCur', 'pwNew', 'pwNew2'].forEach(function (id) { $(id).type = show ? 'text' : 'password'; }); }
$('pwShow').addEventListener('change', function () { setPwType(this.checked); });
$('pwForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var pw = window.ZipPassword, cur = $('pwCur').value, next = $('pwNew').value, again = $('pwNew2').value;
  if (!pw) { pwMsg('비밀번호 기능을 불러오지 못했어요. 새로고침해 주세요.'); return; }
  if (!cur) { pwMsg('현재 비밀번호를 입력해 주세요.'); $('pwCur').focus(); return; }
  if (next.length < 8 || next.length > 16) { pwMsg('새 비밀번호는 8~16자로 입력해 주세요.'); $('pwNew').focus(); return; }
  if (next === cur) { pwMsg('현재 비밀번호와 다른 비밀번호를 입력해 주세요.'); $('pwNew').focus(); return; }
  if (next !== again) { pwMsg('새 비밀번호가 서로 달라요.'); $('pwNew2').focus(); return; }
  pw.verify(cur).then(function (ok) {
    if (!ok) { pwMsg('현재 비밀번호가 맞지 않아요.'); $('pwCur').focus(); return; }
    return pw.set(next).then(function () {
      resetPwForm();
      pwMsg('비밀번호를 바꿨어요.', true);
      setTimeout(function () { if ($('pwMsg').classList.contains('ok')) pwMsg('', true); }, 3000);
    });
  });
});

registerView('settings', fillSettings);
