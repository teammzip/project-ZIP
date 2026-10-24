/* 모든 화면에 공통으로 보이는 부분: 상단 인사말, 오른쪽 프로필 */
import { $, today } from '../core/utils.js';
import { settings } from '../core/state.js';
import { renderRentSummary } from '../views/rent.js';
import { updateDot } from '../views/noti.js';

/* 프로필 그림을 동그라미 요소에 그림. 우선순위: 올린 사진(settings.avatarImg) → 고른 캐릭터(avatarEmoji) → 이름 첫 글자.
 * 배경 색은 settings.avatarColor (없으면 기본 파란 그라데이션). 내 정보 화면·오른쪽 프로필·모바일 상단 아이콘이 같이 씀 */
export function paintAvatar(el, opt) {
  var s = opt || settings;
  el.textContent = s.avatarImg ? '' : (s.avatarEmoji || (s.name || '?').charAt(0));
  el.style.background = '';   // 이전 그림·색을 지우고 다시 칠함
  if (s.avatarImg) el.style.background = '#fff url("' + s.avatarImg + '") center / cover no-repeat';
  else if (s.avatarColor) el.style.background = s.avatarColor;
  el.classList.toggle('is-emoji', !s.avatarImg && !!s.avatarEmoji);
}

// 내 정보(이름·동네·월세)를 화면에 반영: 상단 인사말, 오른쪽 프로필, 월세 카드, 알림 빨간 점. 앱 시작과 설정 저장 때 호출
export function applySettings() {
  $('todayTitle').textContent = '오늘은 ' + (today.getMonth() + 1) + '월 ' + today.getDate() + '일입니다 ' + settings.name + '님';
  $('pName').textContent = settings.name;
  paintAvatar($('pAvatar'));
  paintAvatar($('pAvatar2'));
  $('pRegion').textContent = '📍 ' + (settings.region || '지역 미설정');
  $('pRent').textContent = settings.rent + '만';
  renderRentSummary();
  updateDot();
}
