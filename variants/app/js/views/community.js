/* 커뮤니티: 글 목록·상세, 좋아요·댓글, 동네 범위 */
import { $, el } from '../core/utils.js';
import { store } from '../core/storage.js';
import { state, settings } from '../core/state.js';
import { HOME, NEARBY } from '../data/posts-seed.js';
import { registerView, showView } from '../core/router.js';

// 지금 보는 분류 칩(전체·자유·꿀팁·질문·동네)과 범위(here=우리 동네, near=주변 동네, all=전체)
var catFilter = '전체', scope = 'here';
// 댓글창을 펼쳐 둔 글 번호 모음
var openCmt = {};
// 상세로 열어 둔 글 번호 (없으면 목록을 보여줌)
var selectedPostId = null;

// 글 쓴 시각을 "방금 전 / N분 전 / N시간 전 / N일 전"으로 바꿈
function rel(ts) {
  var m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return m + '분 전';
  var h = Math.floor(m / 60);
  if (h < 24) return h + '시간 전';
  return Math.floor(h / 24) + '일 전';
}
// 글·좋아요·댓글 변경을 저장
function savePosts() { store('zip-posts', state.posts); }

/* 홈의 꿀팁 글을 눌렀을 때: 해당 글 상세로 */
export function openTipDetail(postId) {
  selectedPostId = Number(postId) || null;
  if (selectedPostId) openCmt[selectedPostId] = true;
  catFilter = '전체';
  scope = 'here';
  showView('community');
}

// 글 한 개를 크게 보여주는 상세 카드 (좋아요, 댓글 목록·입력 포함)
function renderPostDetail(post, box) {
  var art = el('article', 'post-detail-card');
  var meta = el('div', 'post-meta');
  meta.appendChild(el('span', 'tag', post.cat));
  if (post.region) meta.appendChild(el('span', 'loc', '📍 ' + post.region));
  meta.appendChild(el('span', null, post.author));
  meta.appendChild(el('span', null, '· ' + rel(post.ts)));
  art.appendChild(meta);
  art.appendChild(el('h3', null, post.title));
  art.appendChild(el('p', null, post.body));

  var act = el('div', 'post-actions');
  var like = el('button', 'pbtn' + (post.liked ? ' on' : ''), '♥ ' + post.likes);
  like.type = 'button';
  like.addEventListener('click', function () {
    post.liked = !post.liked;
    post.likes += post.liked ? 1 : -1;
    savePosts();
    renderPosts();
  });
  act.appendChild(like);
  var cm = el('button', 'pbtn', '💬 ' + post.comments.length);
  cm.type = 'button';
  cm.addEventListener('click', function () { openCmt[post.id] = !openCmt[post.id]; renderPosts(); });
  act.appendChild(cm);
  art.appendChild(act);

  if (openCmt[post.id]) {
    var box2 = el('div', 'cmt detail-cmt');
    post.comments.forEach(function (c) {
      var it = el('div', 'cmt-item');
      it.appendChild(el('b', null, c.author));
      it.appendChild(document.createTextNode(c.text));
      box2.appendChild(it);
    });
    var form = el('form', 'cmt-form');
    var inp = el('input'); inp.type = 'text'; inp.placeholder = '댓글을 입력하세요'; inp.maxLength = 100;
    var btn = el('button', 'btn-primary', '등록'); btn.type = 'submit';
    form.appendChild(inp); form.appendChild(btn);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = inp.value.trim();
      if (!v) return;
      post.comments.push({ author: settings.name, text: v });
      savePosts();
      renderPosts();
    });
    box2.appendChild(form);
    art.appendChild(box2);
  }

  box.appendChild(art);
}

// 커뮤니티 화면 전체: 분류 칩, 동네 범위 안내, 글 목록(또는 선택한 글 상세)을 그림
function renderPosts() {
  var chips = $('catChips'); chips.textContent = '';
  ['전체', '자유', '꿀팁', '질문', '동네'].forEach(function (c) {
    var b = el('button', 'chip' + (c === catFilter ? ' on' : ''), c);
    b.type = 'button';
    b.addEventListener('click', function () { catFilter = c; renderPosts(); });
    chips.appendChild(b);
  });
  var box = $('postList'); box.textContent = '';
  var region = settings.region, near = NEARBY[region] || [];
  $('commTitle').textContent = scope === 'all' ? '전체 동네 이야기' : scope === 'near' ? '주변 동네 이야기' : (region ? region + ' 이야기' : '우리 동네 이야기');
  $('postWhere').textContent = region ? '📍 ' + region : '';
  $('scopeNote').textContent = !region ? '설정에서 우리 동네를 입력하면 동네별로 모아 볼 수 있어요.'
    : scope === 'near' ? (near.length ? '📍 ' + near.join(' · ') + ' 글을 보여줘요.' : '아직 이 지역의 주변 동네 정보가 없어요.')
      : scope === 'here' ? '📍 ' + region + ' 이웃들의 글이에요.' : '모든 동네의 글을 보여줘요.';
  document.querySelectorAll('#scopeSeg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-scope') === scope); });
  var items = state.posts.filter(function (p) {
    if (catFilter !== '전체' && p.cat !== catFilter) return false;
    if (!region || scope === 'all') return true;
    return scope === 'near' ? near.indexOf(p.region) !== -1 : p.region === region;
  }).sort(function (a, b) { return b.ts - a.ts; });
  if (selectedPostId) {
    var selected = items.find(function (p) { return Number(p.id) === Number(selectedPostId); });
    if (selected) {
      var back = el('button', 'btn-line', '‹ 목록으로');
      back.type = 'button';
      back.style.marginBottom = '12px';
      back.addEventListener('click', function () { selectedPostId = null; renderPosts(); });
      box.appendChild(back);
      renderPostDetail(selected, box);
      return;
    }
  }
  if (!items.length) { box.appendChild(el('div', 'empty', '아직 글이 없어요. 첫 글을 써보세요!')); return; }
  items.forEach(function (p) {
    var art = el('article', 'post');
    art.tabIndex = 0;
    art.addEventListener('click', function (e) {
      if (e.target.closest('button')) return;
      selectedPostId = p.id;
      renderPosts();
    });
    art.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectedPostId = p.id;
        renderPosts();
      }
    });
    var meta = el('div', 'post-meta');
    meta.appendChild(el('span', 'tag', p.cat));
    if (p.region) meta.appendChild(el('span', 'loc', '📍 ' + p.region));
    meta.appendChild(el('span', null, p.author));
    meta.appendChild(el('span', null, '· ' + rel(p.ts)));
    art.appendChild(meta);
    art.appendChild(el('h3', null, p.title));
    art.appendChild(el('p', null, p.body));

    var act = el('div', 'post-actions');
    var like = el('button', 'pbtn' + (p.liked ? ' on' : ''), '♥ ' + p.likes);
    like.type = 'button';
    like.addEventListener('click', function () { p.liked = !p.liked; p.likes += p.liked ? 1 : -1; savePosts(); renderPosts(); });
    var cm = el('button', 'pbtn', '💬 ' + p.comments.length);
    cm.type = 'button';
    cm.addEventListener('click', function () { openCmt[p.id] = !openCmt[p.id]; renderPosts(); });
    act.appendChild(like); act.appendChild(cm);
    if (p.mine) {
      var del = el('button', 'pbtn del', '삭제');
      del.type = 'button';
      del.addEventListener('click', function () { state.posts = state.posts.filter(function (x) { return x.id !== p.id; }); savePosts(); renderPosts(); });
      act.appendChild(del);
    }
    art.appendChild(act);

    if (openCmt[p.id]) {
      var box2 = el('div', 'cmt');
      p.comments.forEach(function (c) {
        var it = el('div', 'cmt-item');
        it.appendChild(el('b', null, c.author));
        it.appendChild(document.createTextNode(c.text));
        box2.appendChild(it);
      });
      var form = el('form', 'cmt-form');
      var inp = el('input'); inp.type = 'text'; inp.placeholder = '댓글을 입력하세요'; inp.maxLength = 100;
      var btn = el('button', 'btn-primary', '등록'); btn.type = 'submit';
      form.appendChild(inp); form.appendChild(btn);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = inp.value.trim();
        if (!v) return;
        p.comments.push({ author: settings.name, text: v });
        savePosts(); renderPosts();
      });
      box2.appendChild(form);
      art.appendChild(box2);
    }
    box.appendChild(art);
  });
}
// 글쓰기 폼: 새 글을 맨 위에 추가 (동네는 내 정보의 "우리 동네")
$('postForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var title = $('postTitle').value.trim(), body = $('postBody').value.trim();
  if (!title || !body) return;
  state.posts.unshift({ id: Date.now(), region: settings.region || HOME, cat: $('postCat').value, title: title, body: body, author: settings.name, mine: true, ts: Date.now(), likes: 0, liked: false, comments: [] });
  savePosts();
  $('postTitle').value = ''; $('postBody').value = '';
  catFilter = '전체'; scope = 'here';
  renderPosts();
});
// "우리 동네 / 주변 동네 / 전체" 범위 버튼
$('scopeSeg').addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  scope = b.getAttribute('data-scope'); renderPosts();
});

registerView('community', renderPosts);
