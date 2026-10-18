/* 상단 우측 메뉴 버튼(☰) → 오른쪽에서 열리는 전체 메뉴 패널 (PC 왼쪽 사이드바와 같은 항목).
 * 열려 있는 동안 메뉴 버튼이 ✕로 바뀌어 패널 위에 보이고, 다시 누르면 닫힌다. */
import { $ } from '../core/utils.js';

// 전체 메뉴 패널, 뒷배경, ☰ 버튼
var panel = $('menuPanel'), backdrop = $('menuBackdrop'), btn = $('menuBtn');

// 전체 메뉴를 열고 ☰ 버튼을 ✕로 바꿈
function open() {
  panel.hidden = false; backdrop.hidden = false;
  btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-label', '전체 메뉴 닫기');
  document.body.classList.add('menu-open');
}
// 전체 메뉴를 닫음
function close() {
  panel.hidden = true; backdrop.hidden = true;
  btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', '전체 메뉴 열기');
  document.body.classList.remove('menu-open');
}

// ☰ 버튼: 열려 있으면 닫고, 닫혀 있으면 엶
btn.addEventListener('click', function () { if (panel.hidden) open(); else close(); });
backdrop.addEventListener('click', close);
$('menuClose').addEventListener('click', close);
// 화면 이동이나 사진 선택을 누르면 패널을 닫는다 (이동은 router가 먼저 처리)
panel.addEventListener('click', function (e) { if (e.target.closest('[data-go],[data-action]')) close(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
// 창이 넓어져 메뉴 버튼이 사라지면 열려 있던 패널도 닫는다
window.matchMedia('(min-width: 901px)').addEventListener('change', function (e) { if (e.matches) close(); });
