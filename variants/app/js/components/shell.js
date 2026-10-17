/* 모든 화면에 공통으로 보이는 부분: 상단 인사말, 오른쪽 프로필 */
import { $, today } from '../core/utils.js';
import { settings } from '../core/state.js';
import { renderRentSummary } from '../views/rent.js';
import { updateDot } from '../views/noti.js';

export function applySettings() {
  $('todayTitle').textContent = '오늘은 ' + (today.getMonth() + 1) + '월 ' + today.getDate() + '일입니다 ' + settings.name + '님';
  $('pName').textContent = settings.name;
  $('pAvatar').textContent = settings.name.charAt(0);
  $('pAvatar2').textContent = settings.name.charAt(0);
  $('pRegion').textContent = '📍 ' + (settings.region || '지역 미설정');
  $('pRent').textContent = settings.rent + '만';
  renderRentSummary();
  updateDot();
}
