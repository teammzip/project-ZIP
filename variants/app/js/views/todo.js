/* 이번 주 할 일: 홈 카드, 오른쪽 패널 목록, 상세 화면 */
import { $, el } from '../core/utils.js';
import { store } from '../core/storage.js';
import { state } from '../core/state.js';
import { registerView } from '../core/router.js';

// 할 일 목록 한 곳(box)을 그림: 체크하면 완료 표시, ×를 누르면 삭제. 오른쪽 패널과 할 일 화면이 같은 함수를 씀
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

// 모든 할 일 영역을 한 번에 갱신: 홈 카드(남은 개수·진행 막대), 오른쪽 패널, 할 일 화면
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

// 입력칸의 내용을 새 할 일로 추가 (오른쪽 패널과 할 일 화면 두 곳의 폼이 같이 씀)
function addTodo(input) {
  var v = input.value.trim();
  if (!v) return;
  state.todos.push({ id: Date.now(), text: v, done: false });
  store('zip-todos', state.todos);
  input.value = '';
  renderTodos();
}
// 할 일 화면의 추가 폼
$('todoForm2').addEventListener('submit', function (e) { e.preventDefault(); addTodo($('todoInput2')); });
// "완료한 항목 지우기" 버튼
$('todoClear').addEventListener('click', function () {
  state.todos = state.todos.filter(function (t) { return !t.done; });
  store('zip-todos', state.todos); renderTodos();
});
// 오른쪽 패널의 추가 폼
$('todoForm').addEventListener('submit', function (e) { e.preventDefault(); addTodo($('todoInput')); });

registerView('todo', renderTodos);
