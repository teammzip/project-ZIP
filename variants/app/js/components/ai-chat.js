/* 홈 "AI와 대화" 모달: 홈에서 AI 메뉴로 이동하지 않고 모달창에서 대화를 이어간다.
 * 대화는 이 브라우저에 저장되고(zip-ai-chat), 다시 열면 이어서 볼 수 있다. 답변은 AI 화면과 같은 데모 답변. */
import { $, el } from '../core/utils.js';
import { load, store } from '../core/storage.js';
import { chatReply, CHAT_TOPICS } from '../views/ai.js';

var KEY = 'zip-ai-chat', MAX = 40;
var GREETING = '안녕하세요! 자취하면서 궁금한 걸 편하게 물어보세요. 😊\n분리배출, 냉장고 요리, 곰팡이, 보증금·계약, 공과금까지 도와드려요.';
var modal = $('chatModal'), body = $('chatBody'), input = $('chatInput');
var msgs = load(KEY, null);
if (!Array.isArray(msgs) || !msgs.length) msgs = [{ role: 'bot', text: GREETING }];
var busy = false, lastFocus = null;

function save() { store(KEY, msgs.slice(-MAX)); }
function bubble(m) { return el('div', 'msg ' + m.role, m.text); }
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
    msgs.push({ role: 'bot', text: chatReply(text, topicId) });
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
