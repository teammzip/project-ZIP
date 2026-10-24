/* 프로필 메뉴: 왼쪽 메뉴 맨 아래(모바일은 위쪽 프로필 동그라미)의 프로필 사진을 누르면 프로필 보기·설정·로그아웃이 나온다.
 * - 프로필 보기: 이름·아이디·동네·월세를 보여주는 작은 창 (고치려면 "내 정보 수정")
 * - 설정: 내 정보 화면으로
 * - 로그아웃: components/account.js 가 처리 (시작 화면으로) */
import { $ } from '../core/utils.js';
import { settings } from '../core/state.js';
import { showView } from '../core/router.js';

var menu = $('profileMenu'), modal = $('profileModal');
var openers = [$('profileBtn'), $('mobProfileBtn')];   // 메뉴를 여는 단추: PC 왼쪽 메뉴, 모바일 상단

// 메뉴를 엶: 누른 단추 근처에 뜨도록 위치를 잡음
function openMenu(btn) {
  var r = btn.getBoundingClientRect();
  menu.hidden = false;
  if (window.innerWidth <= 900) { menu.style.left = 'auto'; menu.style.right = '16px'; menu.style.top = (r.bottom + 8) + 'px'; menu.style.bottom = 'auto'; }
  else { menu.style.left = (r.right + 10) + 'px'; menu.style.right = 'auto'; menu.style.bottom = Math.max(window.innerHeight - r.bottom, 12) + 'px'; menu.style.top = 'auto'; }
  openers.forEach(function (o) { o.setAttribute('aria-expanded', o === btn ? 'true' : 'false'); });
}
function closeMenu() { menu.hidden = true; openers.forEach(function (o) { o.setAttribute('aria-expanded', 'false'); }); }

openers.forEach(function (btn) {
  btn.addEventListener('click', function (e) { e.stopPropagation(); if (menu.hidden) openMenu(btn); else closeMenu(); });
});
document.addEventListener('click', function (e) { if (!menu.hidden && !e.target.closest('#profileMenu')) closeMenu(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMenu(); modal.hidden = true; } });
window.addEventListener('resize', closeMenu);

// 프로필 보기 창 내용 채우기
function fillProfile() {
  var uid = '';
  try { var a = JSON.parse(localStorage.getItem('zip-account')); uid = (a && a.uid) || (window.ZipPassword && window.ZipPassword.DEMO_ACCOUNT.uid) || ''; } catch (e) { }
  $('prName').textContent = settings.name;
  $('prUid').textContent = uid || '-';
  $('prRegion').textContent = settings.region || '지역 미설정';
  $('prRent').textContent = settings.rent + '만원 (매월 ' + settings.rentDay + '일)';
  $('prNoti').textContent = settings.notiOn ? '켜짐' : '꺼짐';
}
$('pmProfile').addEventListener('click', function () { closeMenu(); fillProfile(); modal.hidden = false; });
$('pmSettings').addEventListener('click', function () { closeMenu(); showView('settings'); });
$('prClose').addEventListener('click', function () { modal.hidden = true; });
$('prBackdrop').addEventListener('click', function () { modal.hidden = true; });
$('prEdit').addEventListener('click', function () { modal.hidden = true; showView('settings'); });
