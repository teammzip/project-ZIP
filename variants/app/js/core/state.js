/* 앱 데이터를 한 곳에서 만들고 들고 있는다.
 * - settings, readMap, rentPaid 는 객체라 키/속성만 바꾸므로 그대로 내보낸다.
 * - events, posts, bills 는 화면에서 새 배열로 바꿔 끼우기도 해서 state 안에 담는다.
 *   (항상 state.events 처럼 읽어야 최신 값을 본다.) */
import { load, store } from './storage.js';
import { HOME, SEED_POSTS } from '../data/posts-seed.js';
import { demoEvents } from '../data/demo.js';
import { todayStr } from './utils.js';

// 내 정보(이름·동네·월세·납부일·알림). 저장된 값이 있으면 기본값 위에 덮어씀
export var settings = Object.assign({ name: '지기', region: '서울 마포구', rentDay: 15, rent: 55, notiOn: true }, load('zip-settings', {}));
// 읽은 알림 기록 / 월별 월세 납부 기록
export var readMap = load('zip-noti-read', {});
export var rentPaid = load('zip-rent-paid', {});

// 일정 (처음 한 번 오늘 앞뒤 예시 일정을 더함)
var events = load('zip-events', []);
if (!Array.isArray(events)) events = [];
if (!load('zip-demo-events', false)) {   // 둘러보기용: 오늘 앞뒤 일정 예시를 한 번만 더함
  events = events.concat(demoEvents());
  store('zip-events', events); store('zip-demo-events', true);
}

// 기존 할 일은 일정으로 한 번 옮겨 이전 기록을 보존한다.
var todos = load('zip-todos', null);
if (!Array.isArray(todos)) {
  todos = [
    { id: 1, text: '임박 재료 소진하기', done: false },
    { id: 2, text: '욕실 청소', done: true },
    { id: 3, text: '바닥 청소', done: true },
    { id: 4, text: '쓰레기통 비우기', done: true },
    { id: 5, text: '수도요금 납부', done: false },
    { id: 6, text: '재활용 분리배출', done: false }
  ];
}
if (!load('zip-todos-migrated', false)) {
  if (Array.isArray(todos)) {
    todos.forEach(function (todo) {
      if (!todo || typeof todo.text !== 'string' || !todo.text.trim()) return;
      var id = 'todo-' + todo.id;
      if (events.some(function (event) { return event.id === id; })) return;
      var date = /^\d{4}-\d{2}-\d{2}$/.test(todo.date || '') ? todo.date : todayStr;
      events.push({
        id: id,
        date: date,
        time: '',
        title: todo.text,
        done: !!todo.done
      });
    });
  }
  store('zip-events', events);
  store('zip-todos-migrated', true);
  store('zip-todos', []);
}

// 커뮤니티 글 (기본 글을 한 번씩 채워 넣음)
var posts = load('zip-posts', null);
if (!Array.isArray(posts)) posts = [];
posts.forEach(function (p) { if (!p.region) p.region = p.mine ? settings.region : HOME; });
// 관리자 화면에서 지운 기본 글(zip-posts-removed)은 다시 채우지 않음
var removedSeeds = load('zip-posts-removed', []);
SEED_POSTS.forEach(function (sp) { if (removedSeeds.indexOf(sp.id) < 0 && !posts.some(function (p) { return p.id === sp.id; })) posts.push(sp); });
store('zip-posts', posts);

// 공과금 항목 (처음에는 가스·전기·수도 예시)
var bills = load('zip-bills', null);
if (!Array.isArray(bills)) {
  bills = [
    { id: 1, name: '가스', amount: 28000, paid: true },
    { id: 2, name: '전기', amount: 40000, paid: true },
    { id: 3, name: '수도', amount: 32000, paid: false }
  ];
  store('zip-bills', bills);
}

// 화면에서 새 배열로 바꿔 끼우는 데이터는 state 안에 담아 항상 최신 값을 읽게 함
export var state = { events: events, posts: posts, bills: bills };
