/* 내 정보: 프로필(사진·캐릭터·닉네임·한 줄 소개), 이번 달 요약, 바로 가기, 설정 목록
 * - 프로필 편집 / 생활 정보 / 비밀번호 변경은 아래에서 올라오는 창(.sheet-modal)으로 엶 (data-sheet="창 id")
 * - 알림 받기는 목록의 스위치를 누르면 바로 저장
 * - 로그인 방식(아이디 / 카카오 / 구글 / 네이버)은 시작 화면 로그인(login/login.js)이 남긴 'zip-login' 으로 보여 줌
 * - 로그아웃, 데이터 초기화, 회원 탈퇴(js/components/account.js)는 계정·설정 카드 맨 아래 */
import { $, el, todayStr, dayDiff } from '../core/utils.js';
import { load, store, clearAll } from '../core/storage.js';
import { settings, state } from '../core/state.js';
import { nextRentDate } from '../core/rentdate.js';
import { registerView } from '../core/router.js';
import { applySettings, paintAvatar } from '../components/shell.js';
import { unreadCount } from './noti.js';

var DEFAULT_BIO = '오늘도 알찬 자취 생활 중';
// 프로필 캐릭터와 배경 색 (늘리고 싶으면 여기만 고치면 됨)
var CHARS = ['🏠', '🐻', '🐱', '🐰', '🐶', '🦊', '🐧', '🌱', '🍀', '☕', '🎧', '🤖'];
var COLORS = ['', '#ffd6a5', '#ffadad', '#caffbf', '#9bf6ff', '#bdb2ff', '#fdffb6', '#e5e7eb'];

function saveSettings() { store('zip-settings', settings); }

/* ---------- 화면 그리기 ---------- */
function renderMe() {
  paintAvatar($('meAvatar'));
  $('meName').textContent = settings.name;
  $('meBio').textContent = settings.bio || DEFAULT_BIO;
  $('meRegion').textContent = '📍 ' + (settings.region || '동네를 정해 주세요');

  var due = dayDiff(fmtDate(nextRentDate()));
  $('meRent').textContent = settings.rent + '만원';
  $('meRentDue').textContent = '매월 ' + settings.rentDay + '일 · ' + (due === 0 ? '오늘 납부' : 'D-' + due);

  var ym = todayStr.slice(0, 7);
  $('meEvents').textContent = state.events.filter(function (ev) { return ev.date && ev.date.slice(0, 7) === ym; }).length + '개';
  var bills = state.bills || [];
  $('meBills').textContent = (bills.length ? Math.round(bills.filter(function (b) { return b.paid; }).length / bills.length * 100) : 0) + '%';
  $('meNoti').textContent = (settings.notiOn ? unreadCount() : 0) + '개';
  $('mePosts').textContent = state.posts.filter(function (p) { return p.mine; }).length + '개';

  $('meLifeSub').textContent = (settings.region || '동네 미설정') + ' · 월세 ' + settings.rent + '만원 · 매월 ' + settings.rentDay + '일';
  $('setNoti').checked = settings.notiOn;
  renderLogin();
}
/* ---------- 로그인 방식 ---------- */
var BRAND = {
  id: { name: '아이디', svg: '<svg viewBox="0 0 24 24"><path fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>' },
  kakao: { name: '카카오', svg: '<svg viewBox="0 0 24 24"><path fill="#191919" d="M12 4C6.9 4 3 7.2 3 11.1c0 2.5 1.6 4.7 4.1 6l-1 3.7c-.1.3.3.6.6.4l4.4-2.9c.3 0 .6.1.9.1 5.1 0 9-3.2 9-7.2S17.1 4 12 4z"/></svg>' },
  google: { name: '구글', svg: '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.99 10.99 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>' },
  naver: { name: '네이버', svg: '<svg viewBox="0 0 24 24"><path fill="#fff" d="M15.3 12.6 8.4 4H4v16h4.7v-8.6L15.6 20H20V4h-4.7z"/></svg>' }
};
function renderLogin() {
  var rec = load('zip-login', null) || { provider: 'id' };   // 기록이 없으면(앱을 바로 연 경우) 체험용 아이디 계정으로 봄
  var key = BRAND[rec.provider] ? rec.provider : 'id', b = BRAND[key], social = key !== 'id';
  var ico = $('meLoginIco');
  ico.className = 'me-ico brand ' + key;
  ico.innerHTML = b.svg;   // 위 BRAND 의 고정된 그림만 넣음
  $('meLoginTitle').textContent = b.name + '로 로그인했어요';   // 아이디·카카오·구글·네이버 모두 받침이 없어 '로'
  var who = social ? b.name + ' 계정과 연결됨' : (rec.id || (window.ZipPassword ? window.ZipPassword.DEMO_ACCOUNT.uid : 'zipdemo'));
  var at = rec.at ? new Date(rec.at) : null;
  $('meLoginSub').textContent = who + (at ? ' · ' + (at.getMonth() + 1) + '월 ' + at.getDate() + '일 ' + String(at.getHours()).padStart(2, '0') + ':' + String(at.getMinutes()).padStart(2, '0') + ' 로그인' : '');
  $('meLoginTag').textContent = social ? '소셜 로그인' : '일반 로그인';
  $('meLoginTag').className = 'me-tag ' + key;
  // 프로필 카드의 작은 배지
  var via = $('meVia');
  via.className = 'me-via ' + key;
  via.textContent = b.name + ' 로그인';
  // 소셜 로그인은 ZIP 비밀번호가 없어서 비밀번호 변경을 숨김
  $('mePwItem').hidden = social;
}

function fmtDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

function toast(text) {
  var t = $('meToast');
  t.textContent = text; t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(function () { t.hidden = true; }, 1800);
}

/* ---------- 아래에서 올라오는 창 열기·닫기 ---------- */
var openSheet = null, lastFocus = null;
var onOpen = { profileSheet: fillProfile, lifeSheet: fillLife, pwSheet: resetPwForm };
function showSheet(id) {
  lastFocus = document.activeElement;
  openSheet = $(id);
  if (onOpen[id]) onOpen[id]();
  openSheet.hidden = false;
  document.body.classList.add('sheet-open');
  setTimeout(function () { var f = openSheet.querySelector('input:not([type=hidden]):not([type=file]), button'); if (f) f.focus(); }, 50);
}
function closeSheet() {
  if (!openSheet) return;
  openSheet.hidden = true; openSheet = null;
  document.body.classList.remove('sheet-open');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
document.querySelectorAll('[data-sheet]').forEach(function (b) {
  b.addEventListener('click', function () { showSheet(b.getAttribute('data-sheet')); });
});
document.querySelectorAll('.sheet-modal [data-close]').forEach(function (b) { b.addEventListener('click', closeSheet); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

/* ---------- 프로필 편집: 사진 올리기 / 캐릭터 / 배경 색 / 닉네임 / 한 줄 소개 ---------- */
var draft = {};   // 저장 전 고르는 중인 값 (취소하면 버려짐)
function paintPreview() { paintAvatar($('profPreview'), Object.assign({}, draft, { name: $('setName').value.trim() || settings.name })); }
function fillProfile() {
  draft = { avatarImg: settings.avatarImg || '', avatarEmoji: settings.avatarEmoji || '', avatarColor: settings.avatarColor || '' };
  $('setName').value = settings.name;
  $('profBio').value = settings.bio || '';
  $('profMsg').hidden = true;
  renderPickers();
}
function renderPickers() {
  var chars = $('profChars'); chars.textContent = '';
  CHARS.forEach(function (c) {
    var b = el('button', 'prof-char' + (!draft.avatarImg && draft.avatarEmoji === c ? ' on' : ''), c);
    b.type = 'button'; b.setAttribute('aria-label', '캐릭터 ' + c);
    b.addEventListener('click', function () { draft.avatarImg = ''; draft.avatarEmoji = draft.avatarEmoji === c ? '' : c; renderPickers(); });
    chars.appendChild(b);
  });
  var colors = $('profColors'); colors.textContent = '';
  COLORS.forEach(function (c) {
    var b = el('button', 'prof-color' + (draft.avatarColor === c ? ' on' : '') + (c ? '' : ' base'));
    b.type = 'button'; b.setAttribute('aria-label', c ? '배경 색 ' + c : '기본 배경 색');
    if (c) b.style.background = c;
    b.disabled = !!draft.avatarImg;   // 사진을 쓰는 동안에는 배경 색이 안 보임
    b.addEventListener('click', function () { draft.avatarColor = c; renderPickers(); });
    colors.appendChild(b);
  });
  paintPreview();
}
$('setName').addEventListener('input', paintPreview);
$('profUpload').addEventListener('click', function () { $('profFile').click(); });
$('profClear').addEventListener('click', function () { draft = { avatarImg: '', avatarEmoji: '', avatarColor: '' }; renderPickers(); });
// 올린 사진은 가운데를 정사각형으로 잘라 240px 로 줄여서 저장 (브라우저 저장 공간을 아끼려고)
$('profFile').addEventListener('change', function () {
  var file = this.files && this.files[0];
  this.value = '';
  if (!file) return;
  if (!/^image\//.test(file.type)) { profErr('사진 파일만 올릴 수 있어요.'); return; }
  if (file.size > 10 * 1024 * 1024) { profErr('10MB 이하 사진을 골라 주세요.'); return; }
  var url = URL.createObjectURL(file), img = new Image();
  img.onload = function () {
    var size = 240, side = Math.min(img.width, img.height), c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
    URL.revokeObjectURL(url);
    draft.avatarImg = c.toDataURL('image/jpeg', 0.85);
    $('profMsg').hidden = true;
    renderPickers();
  };
  img.onerror = function () { URL.revokeObjectURL(url); profErr('사진을 열 수 없어요. 다른 사진을 골라 주세요.'); };
  img.src = url;
});
function profErr(text) { $('profMsg').textContent = text; $('profMsg').hidden = false; }
$('profForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var name = $('setName').value.trim();
  if (name.length < 2) { profErr('닉네임은 2~12자로 입력해 주세요.'); $('setName').focus(); return; }
  var prev = { name: settings.name, bio: settings.bio, avatarImg: settings.avatarImg, avatarEmoji: settings.avatarEmoji, avatarColor: settings.avatarColor };
  Object.assign(settings, draft, { name: name, bio: $('profBio').value.trim() });
  try { localStorage.setItem('zip-settings', JSON.stringify(settings)); }
  catch (err) {   // 저장 공간이 꽉 찼으면 되돌림
    Object.assign(settings, prev);
    profErr('저장 공간이 부족해서 사진을 저장하지 못했어요. 더 작은 사진을 골라 주세요.');
    return;
  }
  applySettings(); renderMe(); closeSheet();
  toast('프로필을 바꿨어요.');
});

/* ---------- 생활 정보: 동네, 월세, 납부일 ---------- */
function fillLife() {
  $('setRegion').value = settings.region;
  $('setRentDay').value = settings.rentDay;
  $('setRent').value = settings.rent;
}
$('setForm').addEventListener('submit', function (e) {
  e.preventDefault();
  settings.region = $('setRegion').value.trim();
  settings.rentDay = Math.min(31, Math.max(1, Number($('setRentDay').value) || 15));
  settings.rent = Math.max(0, Number($('setRent').value) || 0);
  saveSettings(); applySettings(); renderMe(); closeSheet();
  toast('저장됐어요.');
});

/* ---------- 알림 받기 스위치: 누르면 바로 저장 ---------- */
$('setNoti').addEventListener('change', function () {
  settings.notiOn = this.checked;
  saveSettings(); applySettings(); renderMe();
  toast(settings.notiOn ? '알림을 켰어요.' : '알림을 껐어요.');
});

/* ---------- 로그아웃 · 데이터 초기화 ---------- */
$('meLogout').addEventListener('click', function () { $('pmLogout').click(); });   // 프로필 메뉴의 로그아웃과 같은 동작
$('btnReset').addEventListener('click', function () {
  if (!confirm('일정, 할 일, 가계부(수입·지출), 알림 상태, 커뮤니티 글, AI 대화, 설정이 모두 삭제됩니다. 계속할까요?')) return;
  clearAll();
  location.reload();
});

/* ---------- 비밀번호 변경: 현재 비밀번호 확인 → 새 비밀번호를 두 번 입력 → 저장 (해시 저장은 shared/zip-password.js) ---------- */
function pwMsg(text, ok) { var m = $('pwMsg'); m.textContent = text; m.classList.toggle('ok', !!ok); m.classList.toggle('err', !ok && !!text); }
function resetPwForm() {
  ['pwCur', 'pwNew', 'pwNew2'].forEach(function (id) { $(id).value = ''; });
  $('pwShow').checked = false; setPwType(false);
  pwMsg('', true);
  $('pwDemo').hidden = !window.ZipPassword || window.ZipPassword.hasCustom();   // 가입으로 정한 비밀번호가 없으면 시안 기본 비밀번호를 안내
}
function setPwType(show) { ['pwCur', 'pwNew', 'pwNew2'].forEach(function (id) { $(id).type = show ? 'text' : 'password'; }); }
$('pwShow').addEventListener('change', function () { setPwType(this.checked); });
$('pwForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var pw = window.ZipPassword, cur = $('pwCur').value, next = $('pwNew').value, again = $('pwNew2').value;
  if (!pw) { pwMsg('비밀번호 기능을 불러오지 못했어요. 새로고침해 주세요.'); return; }
  if (!cur) { pwMsg('현재 비밀번호를 입력해 주세요.'); $('pwCur').focus(); return; }
  if (next.length < 8 || next.length > 16) { pwMsg('새 비밀번호는 8~16자로 입력해 주세요.'); $('pwNew').focus(); return; }
  if (next === cur) { pwMsg('현재 비밀번호와 다른 비밀번호를 입력해 주세요.'); $('pwNew').focus(); return; }
  if (next !== again) { pwMsg('새 비밀번호가 서로 달라요.'); $('pwNew2').focus(); return; }
  pw.verify(cur).then(function (ok) {
    if (!ok) { pwMsg('현재 비밀번호가 맞지 않아요.'); $('pwCur').focus(); return; }
    return pw.set(next).then(function () {
      closeSheet();
      toast('비밀번호를 바꿨어요.');
    });
  });
});

registerView('settings', function () { closeSheet(); renderMe(); });
