/* 회원가입 페이지의 동작 (시안이라 실제 계정은 만들지 않음)
 * - 입력 검사, 휴대전화 인증(아무 6자리), 약관 동의·상세보기
 * - 가입하면 닉네임을 앱의 이름(zip-settings)으로 저장하고 앱 화면으로 이동 */
(function () {
  var NEXT = '../app/index.html';
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 회원가입 폼 ---------- */
  var form = $('signupForm'), submit = $('submitBtn');
  var verified = false, touched = {};

  var RULES = {
    uid: function (v) { return /^[a-z0-9]{6,16}$/.test(v) ? '' : '아이디는 6~16자 영문 소문자, 숫자만 쓸 수 있어요.'; },
    pw: function (v) { return v.length >= 8 && v.length <= 16 ? '' : '비밀번호는 8~16자로 입력해 주세요.'; },
    pw2: function (v) { return v && v === form.pw.value ? '' : '비밀번호가 서로 달라요.'; },
    nick: function (v) { v = v.trim(); return v.length >= 2 && v.length <= 12 ? '' : '닉네임은 2~12자로 입력해 주세요.'; },
    phone: function (v) { return /^\d{4}-\d{4}$/.test(v) ? (verified ? '' : '휴대전화 인증을 해 주세요.') : '휴대전화 번호를 확인해 주세요. (010-0000-0000)'; },
    email: function (v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()) ? '' : '이메일 형식을 확인해 주세요.'; },
    addr: function (v) { return v.trim() ? '' : '주소를 입력해 주세요.'; }
  };
  var hints = {};
  [].forEach.call(document.querySelectorAll('.hint[data-for]'), function (h) { hints[h.getAttribute('data-for')] = h; });

  function setHint(name, msg, ok) {
    var h = hints[name]; if (!h) return;
    h.textContent = msg; h.classList.toggle('ok', !!ok);
  }
  function errors() {
    var out = {};
    Object.keys(RULES).forEach(function (k) { var m = RULES[k](form[k].value); if (m) out[k] = m; });
    return out;
  }
  function agreedAll() {
    var need = [].slice.call(form.querySelectorAll('input[data-need]'));
    return need.every(function (c) { return c.checked; });
  }
  function refresh() {
    var errs = errors();
    Object.keys(RULES).forEach(function (k) {
      if (k === 'phone' && verified) { setHint('phone', '휴대전화 인증이 완료됐어요.', true); return; }
      setHint(k, touched[k] && errs[k] ? errs[k] : '');
    });
    submit.disabled = Object.keys(errs).length > 0 || !agreedAll();
  }
  Object.keys(RULES).forEach(function (k) {
    form[k].addEventListener('input', function () {
      if (k === 'pw') touched.pw2 = touched.pw2 || !!form.pw2.value;
      touched[k] = true; refresh();
    });
    form[k].addEventListener('blur', function () { touched[k] = true; refresh(); });
  });

  // 비밀번호 보기 눈 버튼
  [].forEach.call(document.querySelectorAll('[data-eye]'), function (b) {
    b.addEventListener('click', function () {
      var inp = $(b.getAttribute('data-eye')), show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      b.classList.toggle('on', show);
    });
  });

  // 휴대전화: 숫자만 받고 0000-0000 모양으로 맞춤 → 인증(필수) → 인증번호 확인
  form.phone.addEventListener('input', function () {
    var d = form.phone.value.replace(/\D/g, '').slice(0, 8);
    form.phone.value = d.length > 4 ? d.slice(0, 4) + '-' + d.slice(4) : d;
  });
  $('phoneBtn').addEventListener('click', function () {
    touched.phone = true;
    if (!/^\d{4}-\d{4}$/.test(form.phone.value)) { setHint('phone', RULES.phone(form.phone.value)); form.phone.focus(); return; }
    $('codeRow').hidden = false; setHint('phone', '인증번호를 보냈어요. (시안이라 아무 6자리나 입력하면 돼요)', true);
    form.code.focus();
  });
  $('codeBtn').addEventListener('click', function () {
    if (!/^\d{6}$/.test(form.code.value)) { setHint('phone', '인증번호 6자리를 입력해 주세요.'); form.code.focus(); return; }
    verified = true;
    form.phone.readOnly = true; $('codeRow').hidden = true;
    var pb = $('phoneBtn'); pb.textContent = '인증완료'; pb.disabled = true; pb.classList.add('done');
    refresh();
  });

  /* ---------- 약관: 전체 동의 + 상세보기(우리 약관 내용은 login/terms.js) ---------- */
  var T = window.ZIP_TERMS;
  function fillTerms(box, items) {
    items.forEach(function (it) {
      if (it.title) { var h = document.createElement('h3'); h.textContent = it.title; box.appendChild(h); }
      it.lines.forEach(function (line) { var p = document.createElement('p'); p.textContent = line; box.appendChild(p); });
    });
  }
  if (T) {
    var pick = function (idx) { return idx.map(function (i) { return { title: T.sections[i][0], lines: T.sections[i][1] }; }); };
    fillTerms(document.querySelector('[data-terms=service] .terms-box'), pick(T.groups.service));
    fillTerms(document.querySelector('[data-terms=privacy] .terms-box'), pick(T.groups.privacy));
    fillTerms(document.querySelector('[data-terms=policy] .terms-box'), T.policy.map(function (s) { return { title: s[0], lines: s[1] }; }));
  }
  [].forEach.call(document.querySelectorAll('.agree-item .more'), function (b) {
    b.addEventListener('click', function () {
      var box = b.closest('.agree-item').querySelector('.terms-box'), open = box.hidden;
      box.hidden = !open; b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  var items = [].slice.call(form.querySelectorAll('.agree-item input[type=checkbox]'));
  $('agreeAll').addEventListener('change', function () {
    items.forEach(function (c) { c.checked = $('agreeAll').checked; });
    refresh();
  });
  items.forEach(function (c) {
    c.addEventListener('change', function () {
      $('agreeAll').checked = items.every(function (x) { return x.checked; });
      refresh();
    });
  });

  // 가입하기: 닉네임을 앱 이름으로 저장하고 앱으로 이동
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var errs = errors(), first = Object.keys(errs)[0];
    if (first || !agreedAll()) {
      Object.keys(RULES).forEach(function (k) { touched[k] = true; });
      refresh();
      $('formError').textContent = first ? errs[first] : '필수 약관에 동의해 주세요.';
      if (first) form[first].focus();
      return;
    }
    try {
      var st = JSON.parse(localStorage.getItem('zip-settings')) || {};
      st.name = form.nick.value.trim().slice(0, 12);
      localStorage.setItem('zip-settings', JSON.stringify(st));
    } catch (err) { }
    location.href = NEXT;
  });

  refresh();
})();
