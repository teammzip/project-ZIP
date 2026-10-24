/* 화면 전환. 각 화면은 registerView()로 "보여질 때 그릴 함수"를 등록한다.
 * (router가 화면 파일들을 직접 가져오지 않게 해서 서로 얽히지 않도록 함) */
import { $ } from './utils.js';

var VIEWS = ['home', 'calendar', 'ai', 'map', 'noti', 'community', 'settings', 'bills', 'rent', 'spend', 'income', 'memo'];
var onShow = {};

/* 월세·공과금은 "고정 지출" 한 화면에 합쳐서 보여준다 (PC·모바일 같음) */
var FIXED = ['bills', 'rent'];

/* 마이페이지: 사이드바·전체 메뉴에서는 "마이페이지" 한 항목이 켜지고,
 * 안의 화면마다 위쪽 1단계 탭(일정 | 가계부 | 메모 | 알림 | 내 정보)이 정해져 있다 */
var MY_NAV = 'calendar';
var MY_TAB = { calendar: 'calendar', income: 'income', bills: 'income', rent: 'income', spend: 'income', memo: 'memo', noti: 'noti', settings: 'settings' };

export function registerView(name, render) { onShow[name] = render; }

/* selector에 해당하는 요소 중 attr 값이 key와 같은 것만 cls를 켜고(탭이면 aria-selected도 맞춤) 나머지는 끈다 */
function mark(selector, attr, key, cls) {
  document.querySelectorAll(selector).forEach(function (el) {
    var on = el.getAttribute(attr) === key;
    el.classList.toggle(cls, on);
    if (el.getAttribute('role') === 'tab') el.setAttribute('aria-selected', on);
  });
}

export function showView(name) {
  var merged = FIXED.indexOf(name) >= 0;                 // 월세·공과금: 합쳐서 보기
  var inMy = MY_TAB.hasOwnProperty(name);                // 마이페이지 안의 화면인지
  var inExpense = merged || name === 'spend';            // 가계부의 "지출" 탭에 속하는 화면인지
  VIEWS.forEach(function (v) { $('view-' + v).hidden = !(v === name || (merged && FIXED.indexOf(v) >= 0)); });
  document.body.setAttribute('data-view', name);
  document.body.classList.toggle('merged-fixed', merged);

  mark('.nav-item', 'data-view', inMy ? MY_NAV : name, 'active');             // PC 왼쪽 메뉴
  mark('.menu-tile[data-go]', 'data-go', inMy ? MY_NAV : name, 'on');         // 모바일 ☰ 전체 메뉴
  mark('.mob-icon[data-view]', 'data-view', name, 'active');                  // 모바일 상단 아이콘
  mark('.sub-tabs button', 'data-go', name, 'on');                            // 지도 | 이야기
  mark('.my-tab', 'data-go', MY_TAB[name], 'on');                             // 마이페이지 1단계: 일정 | 가계부 | 알림 | 내 정보
  mark('.exp-tab', 'data-go', inExpense ? 'bills' : name, 'on');              // 가계부: 수입 | 지출
  mark('.exp-subtab', 'data-go', merged ? 'bills' : name, 'on');              // 3단계: 고정 지출 | 기타 지출

  if (merged) {
    FIXED.forEach(function (v) { if (onShow[v]) onShow[v](); });              // 합쳐 보면 월세·공과금을 모두 새로 그림
    if (onShow.fixed) onShow.fixed();                                         // 맨 위 고정 지출 합계
  } else if (onShow[name]) onShow[name]();
  window.scrollTo(0, 0);
}

/* 메뉴, 아이콘, data-go 링크에 클릭 연결 (main.js에서 한 번 호출) */
export function initRouter() {
  document.querySelectorAll('.nav-item[data-view]').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); showView(a.getAttribute('data-view')); });
  });
  document.querySelectorAll('.mob-icon[data-view]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      // 상단 아이콘: 이미 켜진 아이콘을 한 번 더 누르면 꺼지고 홈으로 돌아감
      if (a.classList.contains('active')) showView('home');
      else showView(a.getAttribute('data-view'));
    });
  });
  document.querySelectorAll('[data-go]').forEach(function (a) {
    // data-tip-id(꿀팁 글), data-topic(AI 분야)이 붙은 링크는 해당 화면 파일이 직접 처리한다.
    if (a.hasAttribute('data-tip-id') || a.hasAttribute('data-topic')) return;
    a.addEventListener('click', function (e) { e.preventDefault(); showView(a.getAttribute('data-go')); });
  });
}
