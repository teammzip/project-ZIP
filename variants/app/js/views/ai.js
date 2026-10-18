/* AI 도우미 (데모): 분야 선택 → 질문 초안 → 정해진 답변, 사진 첨부 */
import { $, el } from '../core/utils.js';
import { settings } from '../core/state.js';
import { PLACES } from '../data/places.js';
import { registerView, showView } from '../core/router.js';
import { focusCategory } from './map.js';

var photoUrl = null, curTopic = null, draftDirty = false, answerSeq = 0;
var R_TRASH = '분리배출 기본 원칙이에요.\n\n• 플라스틱·캔·유리병: 내용물 비우고 헹군 뒤 라벨 제거\n• 종이: 테이프·스테이플러 제거 후 펼쳐서 묶기\n• 음식물: 종량제(음식물) 봉투나 전용 용기 사용\n• 배달 용기: 기름기가 남으면 일반쓰레기\n\n배출 요일과 시간은 지역마다 달라서, 사는 동네 구청 안내를 꼭 확인하세요.';
var R_COOK = '임박 재료를 기준으로 추천해요.\n\n1) 두부 샐러드: 두부 + 방울토마토 + 올리브유, 5분\n2) 계란 볶음밥: 남은 밥 + 계란 + 대파, 15분\n3) 우유 계란찜: 우유를 섞으면 더 부드러워요\n\n임박 재료부터 먼저 쓰는 걸 추천해요.';
var R_MOLD = '곰팡이 대처 순서예요.\n\n1) 창문을 열어 환기하고 가구를 벽에서 5cm 이상 띄워요\n2) 곰팡이 제거제를 뿌리고 10분 뒤 닦아요\n3) 완전히 말린 뒤 제습제를 두세요\n\n⚠️ 락스와 산성 세제를 절대 섞지 마세요. 유해가스가 나와요. 벽 안쪽 누수가 원인이면 집주인에게 수리를 요청해야 해요.';
var R_CONTRACT = '계약과 보증금 기본 체크리스트예요.\n\n• 입주 당일 전입신고 + 확정일자 받기\n• 계약 전 등기부등본으로 근저당·소유자 확인\n• 입주 때 집 상태를 사진·영상으로 기록해 두기\n• 퇴거 전 집주인에게 미리 통보하고 보증금 반환 일정 확인\n\n법률 자문이 아니라 일반 정보예요. 큰 금액이 걸리면 전문가나 공공기관 상담을 받으세요.';
var R_BILL = '공과금은 납부일을 캘린더에 등록해 두면 편해요. 자동이체를 걸어 두면 연체를 막을 수 있고, 겨울철 가스비는 외출 모드와 단열 뽁뽁이로 줄일 수 있어요.';

function regionText() { return settings.region || '자취방'; }
function photoLine() { return photoUrl ? '\n(사진을 함께 첨부했어요.)' : ''; }
function keywordReply(q) {
  var s = q.replace(/\s/g, '');
  if (/분리|배출|쓰레기|재활용/.test(s)) return R_TRASH;
  if (/요리|냉장고|레시피|뭐해먹|먹을/.test(s)) return R_COOK;
  if (/곰팡이|습기|제습/.test(s)) return R_MOLD;
  if (/보증금|계약|전입|확정일자|월세/.test(s)) return R_CONTRACT;
  if (/공과금|전기|가스|수도|관리비/.test(s)) return R_BILL;
  return '아직 데모 버전이라 몇 가지 주제만 답할 수 있어요.\n\n분리배출, 냉장고 요리, 곰팡이, 보증금·계약, 공과금, 집주인 문자, 근처 탐색 분야를 골라보세요.';
}
function placeKey(what) {
  var keys = Object.keys(PLACES);
  for (var i = 0; i < keys.length; i++) { if (what.indexOf(keys[i].slice(0, 2)) !== -1) return keys[i]; }
  return null;
}

var TOPICS = [
  {
    id: 'qna', ico: '💬', name: '자유 질문', desc: '자취 관련 궁금한 것', photo: false,
    fields: [{ k: 'q', label: '궁금한 점', ph: '예) 세탁기에서 냄새가 나요' }],
    draft: function (v) { return '저는 ' + regionText() + '에서 자취하는 세입자예요.\n\n질문: ' + (v.q || '(여기에 질문을 적어주세요)') + '\n\n초보도 따라 할 수 있게 단계별로 알려주고, 주의할 점도 함께 알려주세요.'; },
    reply: function (v, text) { return keywordReply(v.q || text); }
  },
  {
    id: 'nearby', ico: '📍', name: '근처 탐색', desc: '세탁방·편의점·약국·마트', photo: false,
    fields: [{ k: 'what', label: '찾는 곳', ph: '예) 세탁방, 편의점, 약국, 마트' }, { k: 'cond', label: '원하는 조건 (선택)', ph: '예) 24시간, 이불 빨래 가능' }],
    draft: function (v) { return regionText() + ' 근처에서 걸어서 갈 수 있는 ' + (v.what || '(찾는 곳)') + '을(를) 찾고 있어요.' + (v.cond ? '\n조건: ' + v.cond : '') + '\n\n후보를 가까운 순서로 알려주고, 고를 때 확인할 점도 알려주세요.'; },
    reply: function (v) {
      var key = placeKey(v.what || '');
      if (!key) return '어떤 곳을 찾는지 알려주세요. 지금은 ' + Object.keys(PLACES).join(', ') + ' 예시를 볼 수 있어요.';
      var lines = PLACES[key].map(function (p) { return '• ' + p.n + ' — ' + p.d; });
      return regionText() + ' 근처 ' + key + ' 후보예요 (예시 데이터).\n\n' + lines.join('\n') + '\n\n고를 때는 운영 시간, 가격, 후기를 지도에서 한 번 더 확인하세요.';
    },
    action: function (v) { var key = placeKey(v.what || ''); return key ? { label: '지도에서 보기', run: function () { focusCategory(key); showView('map'); } } : null; }
  },
  {
    id: 'trash', ico: '♻️', name: '분리배출', desc: '이건 어떻게 버려요?', photo: true,
    fields: [{ k: 'item', label: '버릴 물건', ph: '예) 치킨 뼈, 깨진 컵, 택배 박스' }],
    draft: function (v) { return '다음 물건을 어떻게 분리배출해야 하는지 알려주세요.\n물건: ' + (v.item || '(버릴 물건)') + '\n지역: ' + regionText() + photoLine() + '\n\n종류(일반/재활용/음식물/대형)와 버리기 전 손질 방법, 배출 시 주의할 점을 알려주세요.'; },
    reply: function () { return R_TRASH; }
  },
  {
    id: 'cook', ico: '🍳', name: '냉장고 요리', desc: '남은 재료로 한 끼', photo: true,
    fields: [{ k: 'ing', label: '가진 재료', ph: '예) 두부, 방울토마토, 우유' }, { k: 'time', label: '시간·도구 (선택)', ph: '예) 15분, 프라이팬만' }],
    draft: function (v) { return '냉장고에 ' + (v.ing || '(가진 재료)') + '이(가) 있어요.' + (v.time ? '\n조건: ' + v.time : '') + photoLine() + '\n\n임박한 재료를 먼저 쓰는 요리 3가지를 재료·순서와 함께 알려주세요.'; },
    reply: function () { return R_COOK; }
  },
  {
    id: 'clean', ico: '🧹', name: '청소·곰팡이', desc: '얼룩, 냄새, 곰팡이', photo: true,
    fields: [{ k: 'where', label: '어디가 어떤가요?', ph: '예) 욕실 천장에 검은 곰팡이' }],
    draft: function (v) { return '집에서 이런 문제가 생겼어요.\n상황: ' + (v.where || '(장소와 증상)') + photoLine() + '\n\n원인, 직접 해결하는 순서, 쓰면 안 되는 세제, 집주인에게 알려야 하는 경우를 구분해서 알려주세요.'; },
    reply: function () { return R_MOLD; }
  },
  {
    id: 'contract', ico: '📄', name: '계약·보증금', desc: '입주·퇴거 체크리스트', photo: false,
    fields: [{ k: 'sit', label: '지금 상황', ph: '예) 다음 달 퇴거인데 보증금 반환이 걱정돼요' }],
    draft: function (v) { return '월세 계약 중인 세입자예요.\n상황: ' + (v.sit || '(지금 상황)') + '\n\n지금 해야 할 일을 순서대로 알려주고, 놓치기 쉬운 점과 상담받을 수 있는 공공기관도 알려주세요.'; },
    reply: function () { return R_CONTRACT; }
  },
  {
    id: 'landlord', ico: '📝', name: '집주인 문자', desc: '정중한 요청 문자 초안', photo: true,
    fields: [{ k: 'issue', label: '문제 상황', ph: '예) 보일러가 작동하지 않아요' }],
    draft: function (v) { return '집주인에게 보낼 문자를 써주세요.\n보내는 사람: 세입자 ' + settings.name + '\n문제: ' + (v.issue || '(문제 상황)') + photoLine() + '\n\n정중하고 짧게, 방문 가능한 일정을 묻는 내용으로 써주세요.'; },
    reply: function (v) {
      var issue = (v.issue || '').trim() || '확인이 필요한 사항이 있습니다';
      return '집주인에게 보낼 문자 초안이에요.\n\n안녕하세요, 사장님. 세입자 ' + settings.name + '입니다.\n다름이 아니라 아래 문제로 연락드립니다.\n- ' + issue + '\n' + (photoUrl ? '사진을 함께 보내드리니 확인 부탁드립니다.' : '상황을 말씀드리니 확인 부탁드립니다.') + '\n가능하신 방문 일정이나 조치 방법을 알려주시면 맞춰서 협조하겠습니다.\n바쁘신 중에 죄송하고, 회신 기다리겠습니다. 감사합니다.\n\n※ 상황에 맞게 내용을 고쳐서 보내세요.';
    },
    action: function () {
      return {
        label: '문자 복사', run: function (btn, answer) {
          var body = answer.split('\n\n').slice(1, -1).join('\n\n');
          try { navigator.clipboard.writeText(body).then(function () { btn.textContent = '복사됐어요'; }, function () { btn.textContent = '복사 실패'; }); } catch (e) { btn.textContent = '복사 실패'; }
        }
      };
    }
  },
  {
    id: 'bill', ico: '💡', name: '공과금·생활비', desc: '아끼는 법, 납부 관리', photo: false,
    fields: [{ k: 'q', label: '궁금한 점', ph: '예) 겨울 가스비를 줄이고 싶어요' }],
    draft: function (v) { return '자취방 생활비 관련 질문이에요.\n질문: ' + (v.q || '(궁금한 점)') + '\n\n바로 할 수 있는 절약 방법과 납부를 놓치지 않는 방법을 알려주세요.'; },
    reply: function () { return R_BILL; }
  }
];
function topicById(id) { for (var i = 0; i < TOPICS.length; i++) { if (TOPICS[i].id === id) return TOPICS[i]; } return null; }
function fieldValues() {
  var v = {};
  $('draftFields').querySelectorAll('input[data-k]').forEach(function (i) { v[i.getAttribute('data-k')] = i.value.trim(); });
  return v;
}
function refreshDraft() { if (curTopic && !draftDirty) $('draftText').value = curTopic.draft(fieldValues()); }

function renderTopics() {
  var grid = $('topicGrid'); grid.textContent = '';
  TOPICS.forEach(function (t) {
    var b = el('button', 'topic' + (curTopic && curTopic.id === t.id ? ' on' : '') + (photoUrl && t.photo ? ' suggest' : ''));
    b.type = 'button';
    b.appendChild(el('span', 't-ico', t.ico));
    b.appendChild(el('b', null, t.name + (photoUrl && t.photo ? ' · 추천' : '')));
    b.appendChild(el('small', null, t.desc));
    b.addEventListener('click', function () { openTopic(t.id); });
    grid.appendChild(b);
  });
}
function renderPhoto() {
  $('photoBox').hidden = !photoUrl;
  if (photoUrl) $('photoImg').src = photoUrl;
}
function openTopic(id, fill) {
  var t = topicById(id);
  if (!t) return;
  curTopic = t; draftDirty = false; answerSeq++;
  $('draftTitle').textContent = t.ico + ' ' + t.name + ' 질문 초안';
  var box = $('draftFields'); box.textContent = '';
  t.fields.forEach(function (f, i) {
    var lb = el('label', null, f.label);
    var inp = el('input'); inp.type = 'text'; inp.maxLength = 80; inp.placeholder = f.ph; inp.setAttribute('data-k', f.k);
    if (i === 0 && fill) inp.value = fill;
    lb.appendChild(inp);
    box.appendChild(lb);
  });
  $('draftEmpty').hidden = true; $('draftForm').hidden = false; $('draftBack').hidden = false;
  $('aiAnswer').hidden = true; $('answerActions').hidden = true;
  refreshDraft(); renderTopics();
  var first = box.querySelector('input'); if (first) first.focus();
}
function closeTopic() {
  curTopic = null; answerSeq++;
  $('draftTitle').textContent = '질문 초안';
  $('draftEmpty').hidden = false; $('draftForm').hidden = true; $('draftBack').hidden = true;
  $('aiAnswer').hidden = true; $('answerActions').hidden = true;
  renderTopics();
}
function initAI() { renderPhoto(); renderTopics(); }

$('draftFields').addEventListener('input', refreshDraft);
$('draftText').addEventListener('input', function () { draftDirty = true; });
$('draftBack').addEventListener('click', function () { closeTopic(); window.scrollTo(0, 0); });
$('draftForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var text = $('draftText').value.trim();
  if (!curTopic || !text) return;
  var t = curTopic, v = fieldValues(), seq = ++answerSeq;
  var ans = $('aiAnswer'), acts = $('answerActions');
  ans.hidden = false; ans.textContent = '…'; acts.hidden = true; acts.textContent = '';
  setTimeout(function () {
    if (seq !== answerSeq) return;
    var out = t.reply(v, text);
    if (photoUrl && t.photo) out += '\n\n📷 지금은 데모 버전이라 사진 내용을 직접 분석하지는 못해요. 실제 AI를 연결하면 사진을 함께 보내 더 정확히 답해드려요.';
    ans.textContent = out;
    var act = t.action && t.action(v);
    if (act) {
      var b = el('button', 'btn-line', act.label); b.type = 'button';
      b.addEventListener('click', function () { act.run(b, out); });
      acts.appendChild(b); acts.hidden = false;
    }
    ans.scrollIntoView({ block: 'nearest' });
  }, 500);
});

/* 사진 찍기: 홈 카드 버튼과 모바일 하단 사진 탭이 같은 흐름을 쓴다. 선택한 사진을 AI 화면으로 넘김 */
document.querySelectorAll('[data-action="photo"]').forEach(function (button) {
  button.addEventListener('click', function (e) {
    e.preventDefault();
    $('photoInput').click();
  });
});
$('photoInput').addEventListener('change', function () {
  var f = this.files && this.files[0];
  this.value = '';
  if (!f || f.type.indexOf('image/') !== 0) return;
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = URL.createObjectURL(f);
  curTopic = null;
  showView('ai');
  closeTopic();
});
$('photoRemove').addEventListener('click', function () {
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = null; renderPhoto(); renderTopics(); refreshDraft();
});

/* data-topic 링크(예: 쓰레기 화면의 "이건 어떻게 버려요?")는 AI 화면을 열고 해당 분야를 바로 펼친다 */
document.querySelectorAll('[data-topic]').forEach(function (a) {
  a.addEventListener('click', function (e) {
    e.preventDefault();
    showView(a.getAttribute('data-go'));
    openTopic(a.getAttribute('data-topic'), a.getAttribute('data-fill'));
  });
});

/* 홈의 "AI와 대화" 모달(components/ai-chat.js)이 같은 데모 답변을 쓰도록 내보냄 */
export var CHAT_TOPICS = {   // 분야 칩을 눌렀을 때 보낼 질문
  trash: '이건 어떻게 버려요?', cook: '냉장고 재료로 뭐 해먹을까요?', clean: '욕실에 곰팡이가 생겼어요',
  contract: '보증금이랑 계약 때 뭘 확인해야 해요?', bill: '공과금 아끼는 방법이 궁금해요',
  summary: '이번 달 지출 요약해 줘'
};
export function chatReply(text, topicId) {
  var t = topicId && topicById(topicId);
  var out = t ? t.reply({}, text) : keywordReply(text);
  if (out.indexOf('아직 데모 버전이라') === 0) out = '아직 데모 버전이라 몇 가지 주제만 답할 수 있어요.\n\n분리배출, 냉장고 요리, 곰팡이, 보증금·계약, 공과금에 대해 물어보세요. 아래 버튼을 눌러도 돼요.';
  return out;
}

registerView('ai', initAI);
