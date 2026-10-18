/* 홈 "AI와 대화" 모달: 홈에서 AI 메뉴로 이동하지 않고 모달창에서 대화를 이어간다.
 * 대화는 이 브라우저에 저장되고(zip-ai-chat), 다시 열면 이어서 볼 수 있다. 답변은 AI 화면과 같은 데모 답변. */
import { $, el } from '../core/utils.js';
import { load, store } from '../core/storage.js';
import { chatReply, CHAT_TOPICS } from '../views/ai.js';
import { spendBreakdown } from '../views/spend.js';
import { showView } from '../core/router.js';

var KEY = 'zip-ai-chat', MAX = 40;
var GREETING = '안녕하세요! 자취하면서 궁금한 걸 편하게 물어보세요. 😊\n분리배출, 냉장고 요리, 곰팡이, 보증금·계약, 공과금, 이번 달 지출 요약까지 도와드려요.';
var modal = $('chatModal'), body = $('chatBody'), input = $('chatInput');
var msgs = load(KEY, null);
if (!Array.isArray(msgs) || !msgs.length) msgs = [{ role: 'bot', text: GREETING }];
var busy = false, lastFocus = null;
var SUMMARY_ASK = /지출.*(요약|정리|얼마)|얼마.*(썼|지출)|이번\s*달.*(소비|지출)/;   // 직접 입력한 질문도 요약으로 연결

function save() { store(KEY, msgs.slice(-MAX)); }
function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }
function subj(w) { var c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c % 28 ? '이' : '가'; }   // 받침이 있으면 "이", 없으면 "가"
function man(n) { return n >= 10000 ? (Math.round(n / 1000) / 10) + '만원' : won(n); }

/* 이번 달 지출 요약 카드: 대화에는 그때의 숫자를 담아 두고(card), 말풍선 안에 카드로 그린다 */
function spendCard() {
  var cur = spendBreakdown(0), prev = spendBreakdown(1);
  var vari = cur.rows.filter(function (r) { return r[0] !== '월세' && r[0] !== '공과금'; });
  return {
    month: cur.month, total: cur.total, prevTotal: prev.total, fixed: cur.fixed, variable: cur.variable,
    rows: cur.rows.slice(0, 5), top: vari.length ? vari[0] : null
  };
}
function cardNode(c) {
  var box = el('div', 'chat-sum-card');
  box.appendChild(el('small', null, c.month + '월 지출 요약'));
  box.appendChild(el('b', 'chat-sum-total', won(c.total)));
  var diff = c.total - c.prevTotal;
  var cmp = el('p', 'chat-sum-cmp', c.prevTotal ? '지난달보다 ' + (diff === 0 ? '같아요' : man(Math.abs(diff)) + (diff > 0 ? ' 더 썼어요' : ' 덜 썼어요')) : '지난달 기록이 없어요');
  if (diff > 0) cmp.classList.add('up');
  box.appendChild(cmp);
  var list = el('div', 'chat-sum-rows');
  var max = c.rows.length ? c.rows[0][1] : 1;
  c.rows.forEach(function (r) {
    var row = el('div', 'chat-sum-row');
    row.appendChild(el('span', 'n', r[0]));
    var bar = el('span', 'bar'); var fill = el('i'); fill.style.width = Math.max(r[1] / max * 100, 3) + '%'; bar.appendChild(fill);
    row.appendChild(bar);
    row.appendChild(el('span', 'v', man(r[1])));
    list.appendChild(row);
  });
  box.appendChild(list);
  var pct = c.total ? Math.round(c.fixed / c.total * 100) : 0;
  box.appendChild(el('p', 'chat-sum-note', '고정 지출(월세·공과금) ' + pct + '% · 변동 지출 ' + (100 - pct) + '%' + (c.top ? '\n변동 지출 중 ' + c.top[0] + subj(c.top[0]) + ' 가장 커요 (' + man(c.top[1]) + ')' : '')));
  var go = el('button', 'chat-sum-go', '가계부에서 자세히 보기'); go.type = 'button';
  go.addEventListener('click', function () { closeChat(); showView('spend'); });
  box.appendChild(go);
  return box;
}
function bubble(m) {
  var b = el('div', 'msg ' + m.role + (m.card ? ' has-card' : ''), m.text);
  if (m.card) b.appendChild(cardNode(m.card));
  return b;
}
function scrollDown() { body.scrollTop = body.scrollHeight; }
function render() {
  body.textContent = '';
  msgs.forEach(function (m) { body.appendChild(bubble(m)); });
  scrollDown();
}

function send(text, topicId) {
  text = (text || '').trim();
  if (!text || busy) return;
  busy = true;
  msgs.push({ role: 'user', text: text });
  body.appendChild(bubble(msgs[msgs.length - 1]));
  var typing = el('div', 'msg bot typing', '답변을 쓰는 중…');
  body.appendChild(typing); scrollDown();
  setTimeout(function () {
    typing.remove();
    if (topicId === 'summary' || SUMMARY_ASK.test(text)) msgs.push({ role: 'bot', text: '이번 달 지출을 정리해 봤어요.', card: spendCard() });
    else msgs.push({ role: 'bot', text: chatReply(text, topicId) });
    save(); render();
    busy = false;
  }, 600);
  save();
}

function openChat(first) {
  lastFocus = document.activeElement;
  modal.hidden = false;
  render();
  if (first && first.text) send(first.text, first.topic);
  else setTimeout(function () { input.focus(); }, 50);
}
function closeChat() {
  modal.hidden = true;
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

// 홈 카드: 분야 칩 / 질문 입력 / 대화 열기 / 카드의 빈 곳을 누르면 모달로 대화 시작
document.querySelectorAll('#homeAiCard [data-chat-topic]').forEach(function (b) {
  b.addEventListener('click', function () { var t = b.getAttribute('data-chat-topic'); openChat({ text: CHAT_TOPICS[t], topic: t }); });
});
$('homeAskForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var q = $('homeAskInput').value.trim();
  $('homeAskInput').value = '';
  openChat(q ? { text: q } : null);
});
$('homeAiOpen').addEventListener('click', function () { openChat(); });
$('homeAiCard').addEventListener('click', function (e) {
  if (e.target.closest('button, input, form, a')) return;
  openChat();
});

// 모달 안: 보내기 / 분야 칩 / 새 대화 / 닫기
$('chatForm').addEventListener('submit', function (e) { e.preventDefault(); var q = input.value; input.value = ''; send(q); input.focus(); });
modal.querySelectorAll('[data-chat-topic]').forEach(function (b) {
  b.addEventListener('click', function () { var t = b.getAttribute('data-chat-topic'); send(CHAT_TOPICS[t], t); });
});
$('chatNew').addEventListener('click', function () { msgs = [{ role: 'bot', text: GREETING }]; save(); render(); input.focus(); });
$('chatClose').addEventListener('click', closeChat);
$('chatBackdrop').addEventListener('click', closeChat);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeChat(); });
