/* 시작 화면(PC·모바일)의 로그인 창 동작 (시안이라 실제 인증은 하지 않고 화면 흐름만 보여 줌)
 * - 이메일 형식·비밀번호 4자 이상이면 로그인으로 보고 이동. 카카오·구글·네이버 버튼은 누르면 바로 입장
 * - 창 아래 "회원가입" 링크는 별도 가입 페이지(window.SIGNUP_URL)로 이동
 * 이동할 화면은 주소 끝의 ?next=... 또는 window.LOGIN_NEXT 로 정한다. */
(function () {
  var params = new URLSearchParams(location.search);
  var next = params.get('next') || window.LOGIN_NEXT || '../app/index.html';
  var form = document.getElementById('loginForm');

  // 이 브라우저의 내 계정이 이용 정지 중이면 입장하지 않고 안내만 보여 줌 (정지 기록: shared/zip-ban.js)
  function enter() {
    var ban = window.ZipBan && window.ZipBan.meActive();
    if (ban) { document.getElementById('error').textContent = window.ZipBan.message(ban); return; }
    location.href = next;
  }

  // 로그인 버튼
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = form.email.value.trim(), pw = form.pw.value;
    var err = document.getElementById('error');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = '이메일 형식을 확인해 주세요.'; return; }
    if (pw.length < 4) { err.textContent = '비밀번호는 4자 이상 입력해 주세요.'; return; }
    enter();
  });

  // 소셜 로그인 버튼 (지금은 시안이라 누르면 바로 입장)
  [].slice.call(document.querySelectorAll('[data-provider]')).forEach(function (b) { b.addEventListener('click', enter); });

  // 비밀번호 보기/숨기기
  document.getElementById('pwToggle').addEventListener('click', function () {
    var show = form.pw.type === 'password';
    form.pw.type = show ? 'text' : 'password';
    this.textContent = show ? '숨기기' : '보기';
  });

  // 창 아래 "아직 계정이 없나요? 회원가입" (링크는 innerHTML 없이 요소로 만듦)
  var sw = document.getElementById('switchText');
  var link = document.createElement('a');
  link.textContent = '회원가입';
  link.href = window.SIGNUP_URL || '#';
  sw.textContent = '아직 계정이 없나요? ';
  sw.appendChild(link);
})();
