/* 커뮤니티: 글 목록·상세, 좋아요·댓글, 동네 범위 */
import { $, el } from '../core/utils.js';
import { state, settings } from '../core/state.js';
import { HOME, NEARBY } from '../data/posts-seed.js';
import { registerView, showView } from '../core/router.js';

// 지금 보는 분류 칩(전체·자유·꿀팁·질문·동네)과 범위(here=우리 동네, near=주변 동네, all=전체)
var catFilter = '전체', scope = 'here';
// 댓글창을 펼쳐 둔 글 번호 모음
var openCmt = {};
// 상세로 열어 둔 글 번호 (없으면 목록을 보여줌)
var selectedPostId = null;
var editingPostId = null;
var editingAttachments = null;
var MAX_ATTACHMENTS = 5;
var MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

// 글 쓴 시각을 "방금 전 / N분 전 / N시간 전 / N일 전"으로 바꿈
function rel(ts) {
  var m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return m + '분 전';
  var h = Math.floor(m / 60);
  if (h < 24) return h + '시간 전';
  return Math.floor(h / 24) + '일 전';
}
// 내 계정이 이용 정지 중이면 안내를 띄우고 true (글쓰기·댓글·좋아요를 막는 데 씀. 정지 기록: shared/zip-ban.js)
function blocked() {
  var ban = window.ZipBan && window.ZipBan.meActive();
  if (ban) alert(window.ZipBan.message(ban));
  return !!ban;
}
// 글·좋아요·댓글 변경을 저장
function savePosts() {
  try {
    localStorage.setItem('zip-posts', JSON.stringify(state.posts));
    return true;
  } catch (error) {
    alert('저장 공간이 부족해 변경 내용을 저장하지 못했어요. 첨부파일 크기를 줄이거나 기존 게시글을 정리해 주세요.');
    return false;
  }
}

function attachmentSize(attachments) {
  return attachments.reduce(function (total, file) { return total + (Number(file.size) || 0); }, 0);
}

function readAttachments(files) {
  return Promise.all(Array.prototype.map.call(files, function (file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve({ name: file.name, type: file.type, size: file.size, data: reader.result });
      };
      reader.onerror = function () { reject(new Error('파일을 읽지 못했어요: ' + file.name)); };
      reader.readAsDataURL(file);
    });
  }));
}

function renderAttachments(post, box, editing, onRemove) {
  var attachments = Array.isArray(post.attachments) ? post.attachments : [];
  if (!attachments.length) return;
  var list = el('div', 'post-attachments');
  attachments.forEach(function (file, index) {
    var validData = typeof file.data === 'string' && file.data.indexOf('data:') === 0;
    var item = el('div', 'post-attachment');
    if (editing) {
      var remove = el('button', 'pbtn del', '첨부 삭제');
      remove.type = 'button';
      remove.addEventListener('click', function (e) {
        e.stopPropagation();
        if (onRemove) onRemove(index);
      });
      item.appendChild(remove);
    }
    if (file.type && file.type.indexOf('image/') === 0 && validData) {
      var image = document.createElement('img');
      image.src = file.data;
      image.alt = file.name;
      item.appendChild(image);
    }
    if (validData) {
      var link = el('a', null, file.name || '첨부파일');
      link.href = file.data;
      link.download = file.name || 'attachment';
      link.addEventListener('click', function (e) { e.stopPropagation(); });
      item.appendChild(link);
    } else if (!file.type || file.type.indexOf('image/') !== 0) {
      item.appendChild(el('span', null, file.name || '첨부파일'));
    }
    list.appendChild(item);
  });
  box.appendChild(list);
}

function renderPostEditor(post, box) {
  var editing = !!post;
  var currentAttachments = editing ? editingAttachments : [];
  var form = el('form', 'post-editor form');
  var categoryLabel = el('label', null, '분류');
  var category = document.createElement('select');
  ['자유', '꿀팁', '질문', '동네'].forEach(function (name) {
    var option = el('option', null, name);
    option.value = name;
    category.appendChild(option);
  });
  category.value = editing ? post.cat : '자유';
  categoryLabel.appendChild(category);

  var titleLabel = el('label', null, '제목');
  var title = document.createElement('input');
  title.type = 'text';
  title.maxLength = 60;
  title.required = true;
  title.value = editing ? post.title : '';
  titleLabel.appendChild(title);

  var bodyLabel = el('label', null, '내용');
  var body = document.createElement('textarea');
  body.maxLength = 500;
  body.required = true;
  body.value = editing ? post.body : '';
  bodyLabel.appendChild(body);

  var attachmentLabel = el('label', null, '사진·파일 첨부');
  var input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  attachmentLabel.appendChild(input);
  attachmentLabel.appendChild(el('small', 'attachment-hint', '최대 5개, 합계 2MB까지 첨부할 수 있어요.'));
  var message = el('p', 'form-msg err');
  message.setAttribute('role', 'alert');
  message.hidden = true;
  var submit = el('button', 'btn-primary', editing ? '수정 저장' : '등록');
  submit.type = 'submit';
  var cancel = el('button', 'btn-line', '취소');
  cancel.type = 'button';
  cancel.addEventListener('click', function (e) {
    e.stopPropagation();
    editingPostId = null;
    editingAttachments = null;
    renderPosts();
  });
  [categoryLabel, titleLabel, bodyLabel, attachmentLabel].forEach(function (field) { form.appendChild(field); });
  if (editing) {
    renderAttachments({ attachments: currentAttachments }, form, true, function (index) {
      currentAttachments.splice(index, 1);
      editingAttachments = currentAttachments;
      renderPosts();
    });
  }
  form.appendChild(message);
  form.appendChild(submit);
  if (editing) form.appendChild(cancel);
  form.addEventListener('click', function (e) { e.stopPropagation(); });
  form.addEventListener('keydown', function (e) { e.stopPropagation(); });
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (blocked()) return;
    var selectedFiles = Array.prototype.slice.call(input.files);
    if (currentAttachments.length + selectedFiles.length > MAX_ATTACHMENTS) {
      message.textContent = '첨부파일은 최대 ' + MAX_ATTACHMENTS + '개까지 등록할 수 있어요.';
      message.hidden = false;
      return;
    }
    var selectedSize = selectedFiles.reduce(function (total, file) { return total + file.size; }, 0);
    if (attachmentSize(currentAttachments) + selectedSize > MAX_ATTACHMENT_BYTES) {
      message.textContent = '첨부파일의 합계 크기는 2MB 이하여야 해요.';
      message.hidden = false;
      return;
    }
    submit.disabled = true;
    try {
      var additions = await readAttachments(selectedFiles);
      var updated = {
        cat: category.value,
        title: title.value.trim(),
        body: body.value.trim(),
        attachments: currentAttachments.concat(additions)
      };
      if (!updated.title || !updated.body) {
        message.textContent = '제목과 내용을 입력해 주세요.';
        message.hidden = false;
        submit.disabled = false;
        return;
      }
      if (editing) {
        var original = { cat: post.cat, title: post.title, body: post.body, attachments: post.attachments };
        Object.assign(post, updated);
        if (!savePosts()) Object.assign(post, original);
        else {
          editingPostId = null;
          editingAttachments = null;
        }
      } else {
        var newPost = {
          id: Date.now(),
          region: settings.region || HOME,
          cat: updated.cat,
          title: updated.title,
          body: updated.body,
          attachments: updated.attachments,
          author: settings.name,
          mine: true,
          ts: Date.now(),
          likes: 0,
          liked: false,
          comments: []
        };
        state.posts.unshift(newPost);
        if (!savePosts()) state.posts.shift();
        else { catFilter = '전체'; scope = 'here'; }
      }
      renderPosts();
    } catch (error) {
      message.textContent = error.message || '첨부파일을 처리하지 못했어요.';
      message.hidden = false;
      submit.disabled = false;
    }
  });
  box.appendChild(form);
}

function renderPostActions(post, actions) {
  if (!post.mine) return;
  var edit = el('button', 'pbtn', '수정');
  edit.type = 'button';
  edit.addEventListener('click', function (e) {
    e.stopPropagation();
    if (blocked()) return;
    editingPostId = post.id;
    editingAttachments = Array.isArray(post.attachments) ? post.attachments.slice() : [];
    renderPosts();
  });
  actions.appendChild(edit);

  var remove = el('button', 'pbtn del', '삭제');
  remove.type = 'button';
  remove.addEventListener('click', function (e) {
    e.stopPropagation();
    if (blocked() || !confirm('이 게시글을 삭제할까요?')) return;
    var previousPosts = state.posts;
    state.posts = state.posts.filter(function (item) { return item.id !== post.id; });
    if (!savePosts()) state.posts = previousPosts;
    else {
      if (Number(selectedPostId) === Number(post.id)) selectedPostId = null;
      if (Number(editingPostId) === Number(post.id)) {
        editingPostId = null;
        editingAttachments = null;
      }
    }
    renderPosts();
  });
  actions.appendChild(remove);
}

function renderComments(post, box) {
  post.comments.forEach(function (comment) {
    var item = el('div', 'cmt-item');
    item.appendChild(el('b', null, comment.author));
    item.appendChild(el('span', null, comment.text));

    if (comment.mine || comment.author === settings.name) {
      var actions = el('span', 'cmt-actions');
      var edit = el('button', 'pbtn', '수정');
      edit.type = 'button';
      edit.addEventListener('click', function () {
        if (blocked()) return;
        item.textContent = '';
        item.appendChild(el('b', null, comment.author));
        var form = el('form', 'cmt-form');
        var input = el('input');
        input.type = 'text';
        input.maxLength = 100;
        input.required = true;
        input.value = comment.text;
        input.setAttribute('aria-label', '댓글 수정');
        var save = el('button', 'btn-primary', '저장');
        save.type = 'submit';
        var cancel = el('button', 'pbtn', '취소');
        cancel.type = 'button';
        cancel.addEventListener('click', renderPosts);
        form.appendChild(input);
        form.appendChild(save);
        form.appendChild(cancel);
        form.addEventListener('click', function (e) { e.stopPropagation(); });
        form.addEventListener('keydown', function (e) { e.stopPropagation(); });
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (blocked()) return;
          var value = input.value.trim();
          if (!value) return;
          comment.text = value;
          savePosts();
          renderPosts();
        });
        item.appendChild(form);
        input.focus();
      });
      actions.appendChild(edit);

      var del = el('button', 'pbtn del', '삭제');
      del.type = 'button';
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        if (blocked()) return;
        var index = post.comments.indexOf(comment);
        if (index !== -1) {
          post.comments.splice(index, 1);
          savePosts();
          renderPosts();
        }
      });
      actions.appendChild(del);
      item.appendChild(actions);
    }
    box.appendChild(item);
  });

  var form = el('form', 'cmt-form');
  var input = el('input');
  input.type = 'text';
  input.placeholder = '댓글을 입력하세요';
  input.maxLength = 100;
  input.required = true;
  var submit = el('button', 'btn-primary', '등록');
  submit.type = 'submit';
  form.appendChild(input);
  form.appendChild(submit);
  form.addEventListener('click', function (e) { e.stopPropagation(); });
  form.addEventListener('keydown', function (e) { e.stopPropagation(); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (blocked()) return;
    var value = input.value.trim();
    if (!value) return;
    post.comments.push({ author: settings.name, text: value, mine: true });
    savePosts();
    renderPosts();
  });
  box.appendChild(form);
}

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
  if (Number(editingPostId) === Number(post.id)) {
    renderPostEditor(post, box);
    return;
  }
  var art = el('article', 'post-detail-card');
  var meta = el('div', 'post-meta');
  meta.appendChild(el('span', 'tag', post.cat));
  if (post.region) meta.appendChild(el('span', 'loc', '📍 ' + post.region));
  meta.appendChild(el('span', null, post.author));
  meta.appendChild(el('span', null, '· ' + rel(post.ts)));
  art.appendChild(meta);
  art.appendChild(el('h3', null, post.title));
  art.appendChild(el('p', null, post.body));
  renderAttachments(post, art, false);

  var act = el('div', 'post-actions');
  var like = el('button', 'pbtn' + (post.liked ? ' on' : ''), '♥ ' + post.likes);
  like.type = 'button';
  like.addEventListener('click', function () {
    if (blocked()) return;
    post.liked = !post.liked;
    post.likes += post.liked ? 1 : -1;
    savePosts();
    renderPosts();
  });
  act.appendChild(like);
  renderPostActions(post, act);
  var cm = el('button', 'pbtn', '💬 ' + post.comments.length);
  cm.type = 'button';
  cm.addEventListener('click', function () { openCmt[post.id] = !openCmt[post.id]; renderPosts(); });
  act.appendChild(cm);
  art.appendChild(act);

  if (openCmt[post.id]) {
    var box2 = el('div', 'cmt detail-cmt');
    renderComments(post, box2);
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
    if (Number(editingPostId) === Number(p.id)) {
      renderPostEditor(p, art);
      box.appendChild(art);
      return;
    }
    var meta = el('div', 'post-meta');
    meta.appendChild(el('span', 'tag', p.cat));
    if (p.region) meta.appendChild(el('span', 'loc', '📍 ' + p.region));
    meta.appendChild(el('span', null, p.author));
    meta.appendChild(el('span', null, '· ' + rel(p.ts)));
    art.appendChild(meta);
    art.appendChild(el('h3', null, p.title));
    art.appendChild(el('p', null, p.body));
    renderAttachments(p, art, false);

    var act = el('div', 'post-actions');
    var like = el('button', 'pbtn' + (p.liked ? ' on' : ''), '♥ ' + p.likes);
    like.type = 'button';
    like.addEventListener('click', function () { if (blocked()) return; p.liked = !p.liked; p.likes += p.liked ? 1 : -1; savePosts(); renderPosts(); });
    var cm = el('button', 'pbtn', '💬 ' + p.comments.length);
    cm.type = 'button';
    cm.addEventListener('click', function () { openCmt[p.id] = !openCmt[p.id]; renderPosts(); });
    act.appendChild(like); act.appendChild(cm);
    renderPostActions(p, act);
    art.appendChild(act);

    if (openCmt[p.id]) {
      var box2 = el('div', 'cmt');
      renderComments(p, box2);
      art.appendChild(box2);
    }
    box.appendChild(art);
  });
}
// 글쓰기 폼: 새 글을 맨 위에 추가 (동네는 내 정보의 "우리 동네")
$('postForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  if (blocked()) return;
  var title = $('postTitle').value.trim(), body = $('postBody').value.trim();
  if (!title || !body) return;
  var form = $('postForm'), input = $('postAttachments'), message = $('postFormMsg');
  var submit = form.querySelector('button[type="submit"]');
  var files = Array.prototype.slice.call(input.files);
  var size = files.reduce(function (total, file) { return total + file.size; }, 0);
  message.hidden = true;
  if (files.length > MAX_ATTACHMENTS) {
    message.textContent = '첨부파일은 최대 ' + MAX_ATTACHMENTS + '개까지 등록할 수 있어요.';
    message.hidden = false;
    return;
  }
  if (size > MAX_ATTACHMENT_BYTES) {
    message.textContent = '첨부파일의 합계 크기는 2MB 이하여야 해요.';
    message.hidden = false;
    return;
  }
  submit.disabled = true;
  try {
    var attachments = await readAttachments(files);
    var post = {
      id: Date.now(),
      region: settings.region || HOME,
      cat: $('postCat').value,
      title: title,
      body: body,
      attachments: attachments,
      author: settings.name,
      mine: true,
      ts: Date.now(),
      likes: 0,
      liked: false,
      comments: []
    };
    state.posts.unshift(post);
    if (!savePosts()) state.posts.shift();
    else {
      form.reset();
      catFilter = '전체'; scope = 'here';
      selectedPostId = null;
      editingPostId = null;
      editingAttachments = null;
      renderPosts();
      $('postList').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (error) {
    message.textContent = error.message || '첨부파일을 처리하지 못했어요.';
    message.hidden = false;
  } finally {
    submit.disabled = false;
  }
});
// "우리 동네 / 주변 동네 / 전체" 범위 버튼
$('scopeSeg').addEventListener('click', function (e) {
  var b = e.target.closest('button');
  if (!b) return;
  scope = b.getAttribute('data-scope'); renderPosts();
});

registerView('community', renderPosts);
