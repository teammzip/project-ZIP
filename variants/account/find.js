/* 아이디 찾기 · 비밀번호 찾기 페이지의 동작 (시안이라 휴대전화 인증번호는 아무 6자리면 통과)
 * - 탭 전환(#id, #pw)
 * - 아이디 찾기: 닉네임 + 휴대전화 인증 → 아이디를 가리지 않고 그대로 보여 줌
 * - 비밀번호 찾기: 아이디 + 휴대전화 인증 → 같은 화면에서 바로 새 비밀번호를 두 번 입력해 재설정 (메일 발송 없음)
 * 계정 정보 확인은 shared/zip-password.js 가 함 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var Z = window.ZipPassword;

  /* ---------- 탭 ---------- */
  var TABS = ['id', 'pw'];
  var TITLE = { id: '아이디 찾기', pw: '비밀번호 찾기' };
  var tabBtns = [].slice.call(document.querySelectorAll('.tabs [data-tab]'));

  function show(tab) {
    if (TABS.indexOf(tab) < 0) tab = 'id';
    TABS.forEach(function (t) { $('panel-' + t).hidden = t !== tab; });
    tabBtns.forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === tab ? 'true' : 'false'); });
    document.title = 'ZIP - ' + TITLE[tab];
    if (history.replaceState) history.replaceState(null, '', '#' + tab);
  }
  function fromHash() { return location.hash === '#pw' ? 'pw' : 'id'; }
  tabBtns.forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-tab')); }); });
  [].forEach.call(document.querySelectorAll('[data-to]'), function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); show(a.getAttribute('data-to')); });
  });
  window.addEventListener('hashchange', function () { show(fromHash()); });

  /* ---------- 휴대전화 인증 (두 탭이 같은 방식) ----------
   * prefix: 'f'(아이디 찾기) 또는 'p'(비밀번호 찾기). 칸 id 는 phone/code/phoneBtn/codeBtn/codeRow 앞에 prefix 를 붙인 이름 */
  function setupPhone(prefix) {
    var phone = $(prefix + 'phone'), code = $(prefix + 'code'), pBtn = $(prefix + 'phoneBtn'), cBtn = $(prefix + 'codeBtn');
    var row = $(prefix + 'codeRow'), hint = $(prefix + 'phoneHint');
    var state = { verified: false };
    state.reset = function () {   // 인증은 통과했지만 계정이 안 맞았을 때: 번호를 고쳐 다시 인증할 수 있게 되돌림
      state.verified = false; code.value = '';
      phone.readOnly = false; pBtn.disabled = false; pBtn.classList.remove('done'); pBtn.textContent = '인증(필수)';
      say('', false); phone.focus();
    };
    function say(msg, ok) { hint.textContent = msg; hint.classList.toggle('ok', !!ok); }
    phone.addEventListener('input', function () {   // 숫자만 받아 0000-0000 모양으로
      var d = phone.value.replace(/\D/g, '').slice(0, 8);
      phone.value = d.length > 4 ? d.slice(0, 4) + '-' + d.slice(4) : d;
      state.verified = false;
    });
    pBtn.addEventListener('click', function () {
      if (!/^\d{4}-\d{4}$/.test(phone.value)) { say('휴대전화 번호를 확인해 주세요. (010-0000-0000)'); phone.focus(); return; }
      row.hidden = false; say('인증번호를 보냈어요. (시안이라 아무 6자리나 입력하면 돼요)', true); code.focus();
    });
    cBtn.addEventListener('click', function () {
      if (!/^\d{6}$/.test(code.value)) { say('인증번호 6자리를 입력해 주세요.'); code.focus(); return; }
      state.verified = true; row.hidden = true;
      pBtn.textContent = '인증완료'; pBtn.disabled = true; pBtn.classList.add('done'); phone.readOnly = true;
      say('휴대전화 인증이 완료됐어요.', true);
    });
    return state;
  }
  var idPhone = setupPhone('f'), pwPhone = setupPhone('p');

  /* ---------- 아이디 찾기 ---------- */
  $('findIdForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, err = $('idError'), out = $('idResult');
    out.hidden = true; err.textContent = '';
    if (!f.nick.value.trim()) { err.textContent = '가입할 때 쓴 닉네임을 입력해 주세요.'; f.nick.focus(); return; }
    if (!idPhone.verified) { err.textContent = '휴대전화 인증을 해 주세요.'; return; }
    Z.findId(f.nick.value, f.phone.value).then(function (uid) {
      if (!uid) { err.textContent = '입력한 정보와 일치하는 계정을 찾을 수 없어요. 닉네임과 휴대전화를 다시 확인해 주세요.'; idPhone.reset(); return; }
      $('foundId').textContent = uid;   // 아이디는 가리지 않고 그대로 보여 줌
      out.hidden = false;
    });
  });

  /* ---------- 비밀번호 찾기 ---------- */
  var verifiedUid = null;   // 1단계(아이디 + 휴대전화 확인)를 통과한 아이디
  $('findPwForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, err = $('pwError');
    err.textContent = '';
    if (!f.uid.value.trim()) { err.textContent = '아이디를 입력해 주세요.'; f.uid.focus(); return; }
    if (!pwPhone.verified) { err.textContent = '휴대전화 인증을 해 주세요.'; return; }
    Z.checkReset(f.uid.value, f.phone.value).then(function (ok) {
      if (!ok) { err.textContent = '입력한 정보와 일치하는 계정을 찾을 수 없어요. 아이디와 휴대전화를 다시 확인해 주세요.'; pwPhone.reset(); return; }
      verifiedUid = f.uid.value.trim();
      $('findPwForm').hidden = true;                    // 확인이 끝나면 바로 새 비밀번호 입력으로
      $('lead-pw').textContent = '본인 확인이 끝났어요. 새 비밀번호를 정해 주세요.';
      $('resetForm').hidden = false; $('newPw').focus();
    });
  });

  $('resetForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, err = $('resetError'), a = f.pw.value, b = f.pw2.value;
    err.textContent = '';
    if (!verifiedUid) { err.textContent = '본인 확인부터 해 주세요.'; return; }
    if (a.length < 8 || a.length > 16) { err.textContent = '새 비밀번호는 8~16자로 입력해 주세요.'; f.pw.focus(); return; }
    if (a !== b) { err.textContent = '새 비밀번호가 서로 달라요.'; f.pw2.focus(); return; }
    Z.resetPassword(a).then(function () {
      verifiedUid = null;
      $('resetForm').hidden = true;
      $('lead-pw').textContent = '';
      $('resetDone').hidden = false;
    });
  });
  [].forEach.call(document.querySelectorAll('[data-eye]'), function (btn) {   // 새 비밀번호 보기 버튼
    btn.addEventListener('click', function () {
      var inp = $(btn.getAttribute('data-eye')), shown = inp.type === 'password';
      inp.type = shown ? 'text' : 'password'; btn.classList.toggle('on', shown);
    });
  });

  /* ---------- 체험 안내: 가입 기록이 없을 때만 시험용 정보를 알려 줌 ---------- */
  if (Z && !Z.hasCustom()) {
    var d = Z.DEMO_ACCOUNT;
    [].forEach.call(document.querySelectorAll('.demo-guide'), function (n) {
      n.textContent = n.getAttribute('data-kind') === 'id'
        ? '체험용: 가입 기록이 없으면 닉네임 "' + d.nick + '", 휴대전화 010-' + d.phone + ' 로 찾아볼 수 있어요.'
        : '체험용: 가입 기록이 없으면 아이디 "' + d.uid + '", 휴대전화 010-' + d.phone + ' 로 재설정해 볼 수 있어요.';
      n.hidden = false;
    });
  }

  show(fromHash());
})();
