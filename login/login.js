/* 로그인 예시용 동작 (실제 인증이 아니라 화면 흐름만 보여주는 데모) */
(function () {
  var params = new URLSearchParams(location.search);
  var next = params.get('next') || window.LOGIN_NEXT || '../variants/app/index.html';   // 다른 폴더에서 쓸 때는 LOGIN_NEXT로 이동할 주소를 미리 지정
  var form = document.getElementById('loginForm');
  var mode = 'login';

  function setMode(m) {
    mode = m;
    document.getElementById('title').textContent = m === 'login' ? '' : '어서와 ZIP은 처음이지?';
    document.getElementById('lead').textContent = '';
    document.getElementById('nickField').hidden = m === 'login';
    document.getElementById('addrField').hidden = m === 'login';
    document.getElementById('termsField').hidden = m === 'login';
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
    if (mode === 'signup' && !form.addr.value.trim()) { err.textContent = '주소를 입력해 주세요.'; return; }
    if (mode === 'signup' && !form.agree.checked) { err.textContent = '약관에 동의해 주세요.'; return; }
    if (mode === 'signup') saveNick(form.nick.value.trim());
    enter();
  });

  [].slice.call(document.querySelectorAll('#kakaoBtn, [data-provider]')).forEach(function (b) { b.addEventListener('click', enter); });   // 카카오·구글·네이버: 지금은 시안이라 누르면 바로 입장
  document.getElementById('pwToggle').addEventListener('click', function () {
    var t = form.pw.type === 'password';
    form.pw.type = t ? 'text' : 'password';
    this.textContent = t ? '숨기기' : '보기';
  });
  // 약관 전체 보기: 요약 줄 옆 "전체 보기" → 조항별로 펼쳐 보는 창 (내용은 terms.js, innerHTML 없이 요소로 만듦)
  function initTerms() {
    var data = window.ZIP_TERMS, box = document.getElementById('termsField');
    if (!data || !box) return;
    var tv = document.createElement('div');
    tv.className = 'tv'; tv.hidden = true;
    var win = document.createElement('div');
    win.className = 'tv-box'; win.setAttribute('role', 'dialog'); win.setAttribute('aria-modal', 'true');
    var head = document.createElement('div'); head.className = 'tv-head';
    var h = document.createElement('h3'); h.textContent = data.title;
    var up = document.createElement('p'); up.textContent = data.updated;
    head.appendChild(h); head.appendChild(up);
    var body = document.createElement('div'); body.className = 'tv-body';
    data.sections.forEach(function (s, i) {
      var d = document.createElement('details');
      if (i === 0) d.open = true;
      var sm = document.createElement('summary'); sm.textContent = s[0];
      d.appendChild(sm);
      s[1].forEach(function (line) { var p = document.createElement('p'); p.textContent = line; d.appendChild(p); });
      body.appendChild(d);
    });
    var foot = document.createElement('div'); foot.className = 'tv-foot';
    var close = document.createElement('button'); close.type = 'button'; close.className = 'btn btn-sub'; close.textContent = '닫기';
    var agree = document.createElement('button'); agree.type = 'button'; agree.className = 'btn btn-main'; agree.textContent = '동의하고 닫기';
    foot.appendChild(close); foot.appendChild(agree);
    win.appendChild(head); win.appendChild(body); win.appendChild(foot);
    tv.appendChild(win); document.body.appendChild(tv);

    var more = document.createElement('button');
    more.type = 'button'; more.className = 'terms-more'; more.textContent = '전체 보기';
    box.querySelector('.terms-text').appendChild(more);

    function open() { tv.hidden = false; body.scrollTop = 0; agree.focus(); }
    function shut() { tv.hidden = true; more.focus(); }
    more.addEventListener('click', open);
    close.addEventListener('click', shut);
    agree.addEventListener('click', function () { form.agree.checked = true; shut(); });
    tv.addEventListener('mousedown', function (e) { if (e.target === tv) shut(); });
    window.addEventListener('keydown', function (e) {   // Esc는 약관 창만 닫고, 아래 로그인 창은 그대로 둠
      if (e.key === 'Escape' && !tv.hidden) { e.stopImmediatePropagation(); shut(); }
    }, true);
  }
  initTerms();
  window.setLoginMode = setMode;   // 시작 화면의 "회원가입" 버튼이 로그인 창을 가입 모드로 열 때 사용
  setMode('login');
})();
