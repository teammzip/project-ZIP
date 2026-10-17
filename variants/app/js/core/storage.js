/* localStorage 읽기/쓰기. 나중에 서버 API로 바꿀 때 이 파일(과 state.js)만 고치면 된다. */
export function load(key, fallback) {
  try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
}
export function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { } }
/* 이 앱이 저장한 데이터(키가 zip- 으로 시작)를 모두 지움: 데이터 초기화, 회원 탈퇴에서 사용 */
export function clearAll() {
  try {
    Object.keys(localStorage).filter(function (k) { return k.indexOf('zip-') === 0; }).forEach(function (k) { localStorage.removeItem(k); });
  } catch (e) { }
}
