/* 로그인 예시용 동작 (실제 인증이 아니라 화면 흐름만 보여주는 데모) */
(function () {
  var params = new URLSearchParams(location.search);
  var next = params.get('next') || window.LOGIN_NEXT || '../variants/app/index.html';   // 다른 폴더에서 쓸 때는 LOGIN_NEXT로 이동할 주소를 미리 지정
  var form = document.getElementById('loginForm');
  var mode = 'login';

  function setMode(m) {
    mode = m;
    document.getElementById('title').textContent = m === 'login' ? '다시 만나서 반가워요' : '처음이세요? 가입해요';
    document.getElementById('lead').textContent = m === 'login' ? '로그인하고 내 일정과 할 일을 이어서 확인하세요.' : '이메일과 비밀번호만 있으면 바로 시작할 수 있어요.';
    document.getElementById('nickField').hidden = m === 'login';
    document.getElementById('loginOnly').hidden = m !== 'login';
    document.getElementById('submitBtn').textContent = m === 'login' ? '로그인' : '가입하고 시작하기';
    var sw = document.getElementById('switchText');   // 고정 문구 + 전환 링크 (innerHTML 없이 요소로 만듦)
    var link = document.createElement('a');
    link.id = 'swLink';
    link.textContent = m === 'login' ? '회원가입' : '로그인';
    link.addEventListener('click', function () { setMode(m === 'login' ? 'signup' : 'login'); });
    sw.textContent = (m === 'login' ? '아직 계정이 없나요? ' : '이미 계정이 있나요? ');
    sw.appendChild(link);
    document.getElementById('error').textContent = '';
  }

  // 가입하면 입력한 닉네임을 앱의 이름(설정)으로 저장해서 앱의 인사말에 바로 쓰이게 함 (앱 설정 키: zip-settings)
  function saveNick(nick) {
    try {
      var st = JSON.parse(localStorage.getItem('zip-settings')) || {};
      st.name = nick.slice(0, 12);
      localStorage.setItem('zip-settings', JSON.stringify(st));
    } catch (e) { }
  }

  function enter() {
    if (typeof window.onLoginSuccess === 'function') window.onLoginSuccess(next);   // B안: 같은 페이지에서 덮개 제거
    else location.href = next;                                                    // A·C안: 시안 화면으로 이동
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = form.email.value.trim(), pw = form.pw.value;
    var err = document.getElementById('error');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = '이메일 형식을 확인해 주세요.'; return; }
    if (pw.length < 4) { err.textContent = '비밀번호는 4자 이상 입력해 주세요.'; return; }
    if (mode === 'signup' && !form.nick.value.trim()) { err.textContent = '닉네임을 입력해 주세요.'; return; }
    if (mode === 'signup') saveNick(form.nick.value.trim());
    enter();
  });

  document.getElementById('kakaoBtn').addEventListener('click', enter);
  document.getElementById('pwToggle').addEventListener('click', function () {
    var t = form.pw.type === 'password';
    form.pw.type = t ? 'text' : 'password';
    this.textContent = t ? '숨기기' : '보기';
  });
  window.setLoginMode = setMode;   // 시작 화면의 "회원가입" 버튼이 로그인 창을 가입 모드로 열 때 사용
  setMode('login');
})();
