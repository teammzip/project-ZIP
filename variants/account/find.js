/* 아이디 찾기 · 비밀번호 찾기 페이지의 동작: 탭 전환(#id, #pw), 찾기 폼 (시안이라 예시 결과만 보여 줌) */
(function () {
  var $ = function (id) { return document.getElementById(id); };
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

  // 아이디 찾기: 가입할 때 쓴 닉네임 + 주소가 있으면 일부만 가린 아이디를 알려 주는 흐름 (시안이라 예시 결과)
  $('findIdForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    $('idResult').hidden = true;
    if (!f.nick.value.trim()) { $('idError').textContent = '가입할 때 쓴 닉네임을 입력해 주세요.'; return; }
    if (!f.addr.value.trim()) { $('idError').textContent = '가입할 때 입력한 주소를 입력해 주세요.'; return; }
    $('idError').textContent = '';
    $('idResult').hidden = false;
  });

  // 비밀번호 찾기: 아이디 + 이메일로 재설정 안내를 보내는 흐름 (시안이라 실제로 보내지는 않음)
  $('findPwForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target;
    $('pwResult').hidden = true;
    if (!f.uid.value.trim()) { $('pwError').textContent = '아이디를 입력해 주세요.'; return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim())) { $('pwError').textContent = '이메일 형식을 확인해 주세요.'; return; }
    $('pwError').textContent = '';
    $('pwSentTo').textContent = f.email.value.trim();
    $('pwResult').hidden = false;
  });

  show(fromHash());
})();
