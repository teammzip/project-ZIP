/* 계정: 로그아웃, 회원 탈퇴.
 * 지금은 서버가 없어서 로그인 상태를 따로 저장하지 않는다. 로그아웃은 시작 화면으로 돌아가는 것이고,
 * 회원 탈퇴는 이 브라우저에 저장된 앱 데이터를 모두 지운 뒤 시작 화면으로 보낸다. (서버를 붙이면 여기서 API를 부르면 됨) */
import { $ } from '../core/utils.js';
import { clearAll } from '../core/storage.js';

// 좁은 화면(모바일)은 모바일 시작, 넓은 화면은 PC 시작으로
function startUrl() { return window.innerWidth <= 900 ? '../start-mobile/index.html' : '../start-pc/index.html'; }

// 프로필 메뉴의 로그아웃
$('pmLogout').addEventListener('click', function () { location.href = startUrl(); });

// 회원 탈퇴 확인 창의 요소들과 상태(done: 탈퇴 완료 상태)
var modal = $('confirmModal'), box = $('confirmBox'), check = $('confirmCheck'), okBtn = $('confirmOk'), cancelBtn = $('confirmCancel');
var done = false, lastFocus = null;

// 탈퇴 확인 창을 엶: 안내문과 "위 내용을 확인했습니다" 체크, 체크해야 "탈퇴하기"가 켜짐
function open() {
  done = false; lastFocus = document.activeElement;
  $('confirmTitle').textContent = '정말 탈퇴할까요?';
  $('confirmText').textContent = '탈퇴하면 이 기기에 저장된 일정, 할 일, 가계부(수입·지출), 알림 상태, 커뮤니티 글, AI 대화, 설정이 모두 삭제되고 되돌릴 수 없어요.';
  $('confirmCheckWrap').hidden = false; check.checked = false;
  okBtn.textContent = '탈퇴하기'; okBtn.disabled = true; cancelBtn.hidden = false;
  modal.hidden = false;
  setTimeout(function () { check.focus(); }, 50);
}
function close() {
  if (done) return;   // 탈퇴가 끝난 뒤에는 닫을 수 없고 시작 화면으로만 갈 수 있음
  modal.hidden = true;
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

$('btnWithdraw').addEventListener('click', open);
check.addEventListener('change', function () { okBtn.disabled = !check.checked; });
cancelBtn.addEventListener('click', close);
$('confirmBackdrop').addEventListener('click', close);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) close(); });
// "탈퇴하기": 앱 데이터를 모두 지우고 완료 화면으로 바꿈 / 완료 후에는 "처음 화면으로"
okBtn.addEventListener('click', function () {
  if (done) { location.href = startUrl(); return; }
  if (!check.checked) return;
  clearAll();
  done = true;
  $('confirmTitle').textContent = '탈퇴가 완료됐어요';
  $('confirmText').textContent = '이용해 주셔서 감사합니다. 저장된 정보를 모두 삭제했어요. 언제든 다시 가입할 수 있어요.';
  $('confirmCheckWrap').hidden = true; cancelBtn.hidden = true;
  okBtn.textContent = '처음 화면으로'; okBtn.disabled = false; okBtn.focus();
});
