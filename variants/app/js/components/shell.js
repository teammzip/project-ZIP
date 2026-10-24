/* 모든 화면에 공통으로 보이는 부분: 상단 인사말, 프로필 사진·메뉴의 이름 */
import { $, today } from '../core/utils.js';
import { settings } from '../core/state.js';
import { renderRentSummary } from '../views/rent.js';
import { updateDot } from '../views/noti.js';

// 내 정보(이름·동네·월세)를 화면에 반영: 상단 인사말, 프로필 사진·메뉴, 월세 카드, 알림 빨간 점. 앱 시작과 설정 저장 때 호출
export function applySettings() {
  $('todayTitle').textContent = '오늘은 ' + (today.getMonth() + 1) + '월 ' + today.getDate() + '일입니다 ' + settings.name + '님';
  $('pName').textContent = settings.name;
  [].forEach.call(document.querySelectorAll('.js-avatar'), function (a) { a.textContent = settings.name.charAt(0); });   // 프로필 사진(이름 첫 글자) 모두
  $('pRegion').textContent = '📍 ' + (settings.region || '지역 미설정');
  renderRentSummary();
  updateDot();
}
