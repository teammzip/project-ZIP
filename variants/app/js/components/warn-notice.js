/* 경고 안내 창: 운영자에게 경고를 받았다는 걸 알리는 모달.
 * - 지금은 시안이라 compare.html 의 "경고창" 버튼(주소 ?demo=warn)으로만 뜬다. 예시 사유·횟수를 보여 줌.
 * - 실제 서비스에서는 서버의 경고 이력(user_sanctions)에서 아직 확인하지 않은 경고가 있을 때 로그인 직후 뜨게 한다.
 * - 정지는 이 창이 아니라 별도 화면(variants/suspended)이다. */
import { $ } from '../core/utils.js';

var modal = $('warnModal');

export function showWarn(why, count) {
  $('warnWhy').textContent = why;
  $('warnCnt').textContent = count + '회';
  modal.hidden = false;
  $('warnOk').focus();
}
$('warnOk').addEventListener('click', function () { modal.hidden = true; });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') modal.hidden = true; });

if (new URLSearchParams(location.search).get('demo') === 'warn') showWarn('커뮤니티 운영 정책 위반(욕설·비방)', 2);
