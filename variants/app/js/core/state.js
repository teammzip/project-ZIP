/* 앱 데이터를 한 곳에서 만들고 들고 있는다.
 * - settings, readMap, rentPaid 는 객체라 키/속성만 바꾸므로 그대로 내보낸다.
 * - events, posts, todos, bills 는 화면에서 새 배열로 바꿔 끼우기도 해서 state 안에 담는다.
 *   (항상 state.events 처럼 읽어야 최신 값을 본다.) */
import { load, store } from './storage.js';
import { HOME, SEED_POSTS } from '../data/posts-seed.js';
import { demoEvents } from '../data/demo.js';

export var settings = Object.assign({ name: '지기', region: '서울 마포구', rentDay: 15, rent: 55, notiOn: true }, load('zip-settings', {}));
export var readMap = load('zip-noti-read', {});
export var rentPaid = load('zip-rent-paid', {});

var events = load('zip-events', []);
if (!Array.isArray(events)) events = [];
if (!load('zip-demo-events', false)) {   // 둘러보기용: 오늘 앞뒤 일정 예시를 한 번만 더함
  events = events.concat(demoEvents());
  store('zip-events', events); store('zip-demo-events', true);
}

var posts = load('zip-posts', null);
if (!Array.isArray(posts)) posts = [];
posts.forEach(function (p) { if (!p.region) p.region = p.mine ? settings.region : HOME; });
SEED_POSTS.forEach(function (sp) { if (!posts.some(function (p) { return p.id === sp.id; })) posts.push(sp); });
store('zip-posts', posts);

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
  store('zip-todos', todos);
}

var bills = load('zip-bills', null);
if (!Array.isArray(bills)) {
  bills = [
    { id: 1, name: '가스', amount: 28000, paid: true },
    { id: 2, name: '전기', amount: 40000, paid: true },
    { id: 3, name: '수도', amount: 32000, paid: false }
  ];
  store('zip-bills', bills);
}

export var state = { events: events, posts: posts, todos: todos, bills: bills };
