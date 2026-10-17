/* 이번 주 할 일: 홈 카드, 오른쪽 패널 목록, 상세 화면 */
import { $, el } from '../core/utils.js';
import { store } from '../core/storage.js';
import { state } from '../core/state.js';
import { registerView } from '../core/router.js';

function renderTodoBox(box) {
  box.textContent = '';
  state.todos.forEach(function (t) {
    var row = el('div', 'todo' + (t.done ? ' done' : ''));
    var cb = el('input'); cb.type = 'checkbox'; cb.checked = t.done; cb.setAttribute('aria-label', t.text);
    cb.addEventListener('change', function () { t.done = cb.checked; store('zip-todos', state.todos); renderTodos(); });
    var del = el('button', 'del', '×'); del.type = 'button'; del.title = '삭제';
    del.addEventListener('click', function () { state.todos = state.todos.filter(function (x) { return x.id !== t.id; }); store('zip-todos', state.todos); renderTodos(); });
    row.appendChild(cb); row.appendChild(el('span', null, t.text)); row.appendChild(del);
    box.appendChild(row);
  });
  if (!state.todos.length) box.appendChild(el('div', 'empty', '할 일이 없어요. 아래에서 추가해 보세요.'));
}

export function renderTodos() {
  var done = state.todos.filter(function (t) { return t.done; }).length;
  var total = state.todos.length;
  var pct = total ? Math.round(done / total * 100) : 0;
  var sub = total ? '전체 ' + total + '개 중 ' + done + '개 완료' : '할 일을 추가해 보세요';
  renderTodoBox($('todoList')); renderTodoBox($('todoList2'));
  $('todoCount').textContent = total ? done + '/' + total : '';
  $('todoCount2').textContent = total ? done + '/' + total : '';
  $('todoLeft').textContent = total - done;
  $('todoBar').style.width = pct + '%'; $('todoBar2').style.width = pct + '%';
  $('todoSub').textContent = sub; $('todoSub2').textContent = sub + (total ? ' · ' + pct + '%' : '');
}

function addTodo(input) {
  var v = input.value.trim();
  if (!v) return;
  state.todos.push({ id: Date.now(), text: v, done: false });
  store('zip-todos', state.todos);
  input.value = '';
  renderTodos();
}
$('todoForm2').addEventListener('submit', function (e) { e.preventDefault(); addTodo($('todoInput2')); });
$('todoClear').addEventListener('click', function () {
  state.todos = state.todos.filter(function (t) { return !t.done; });
  store('zip-todos', state.todos); renderTodos();
});
$('todoForm').addEventListener('submit', function (e) { e.preventDefault(); addTodo($('todoInput')); });

registerView('todo', renderTodos);
