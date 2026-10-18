/* 회원가입 · 아이디/비밀번호 찾기 페이지 공통: "로그인", 로고 링크가 어느 시작 화면으로 돌아갈지 정함
 * 폭 900px 이하(모바일)면 모바일 시작(문이 열리고 로봇이 들어가는 화면), 아니면 PC 시작으로 간다. */
(function () {
  var mobile = window.matchMedia('(max-width: 900px)').matches;
  var start = mobile ? '../start-mobile/index.html' : '../start-pc/index.html';
  [].forEach.call(document.querySelectorAll('[data-start-login]'), function (a) { a.setAttribute('href', start + '#login'); });
  [].forEach.call(document.querySelectorAll('[data-start-home]'), function (a) { a.setAttribute('href', start); });
})();
