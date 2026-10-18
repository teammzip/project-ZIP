/* 모바일용 스크롤바: 화면(문서) 스크롤에 맞춰 오른쪽에 얇은 반투명 알약이 떴다가 잠깐 뒤 사라지고,
 * 알약을 누른 채 위아래로 끌면 화면도 같이 움직인다. (폭 900px 이하에서만 동작, 모양은 mobile-scroll.css) */
(function () {
  var mq = window.matchMedia('(max-width: 900px)');
  var thumb = document.createElement('div');
  thumb.className = 'ms-thumb';
  thumb.setAttribute('aria-hidden', 'true');
  document.body.appendChild(thumb);

  var HIDE_MS = 900, hideTimer = null, dragging = false, startY = 0, startTop = 0, geo = null;

  function root() { return document.scrollingElement || document.documentElement; }
  function inset(name, fallback) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return isNaN(v) ? fallback : v;
  }

  /* 알약 크기와 움직일 수 있는 범위 계산 */
  function measure() {
    var r = root(), vh = window.innerHeight;
    var top = inset('--ms-top', 6), bottom = inset('--ms-bottom', 6);
    var track = vh - top - bottom, max = r.scrollHeight - vh;
    if (!mq.matches || max <= 1 || track <= 40) return null;
    var h = Math.max(44, Math.round(track * vh / r.scrollHeight));
    return { top: top, track: track, h: h, max: max, run: track - h };
  }

  function place() {
    geo = measure();
    if (!geo) { thumb.classList.remove('show', 'drag'); return false; }
    var y = geo.top + (root().scrollTop / geo.max) * geo.run;
    thumb.style.height = geo.h + 'px';
    thumb.style.transform = 'translateY(' + y + 'px)';
    return true;
  }

  function reveal() {
    if (!place()) return;
    thumb.classList.add('show');
    clearTimeout(hideTimer);
    if (!dragging) hideTimer = setTimeout(function () { thumb.classList.remove('show'); }, HIDE_MS);
  }

  window.addEventListener('scroll', reveal, { passive: true });
  window.addEventListener('resize', function () { if (thumb.classList.contains('show')) place(); });
  if (window.ResizeObserver) {   // 화면 내용이 바뀌어 길이가 달라지면 알약 크기도 다시 계산
    new ResizeObserver(function () { if (thumb.classList.contains('show')) place(); }).observe(document.body);
  }
  if (mq.addEventListener) mq.addEventListener('change', function () { thumb.classList.remove('show', 'drag'); });

  /* 알약을 잡고 끌기 */
  thumb.addEventListener('pointerdown', function (e) {
    if (!measure()) return;
    e.preventDefault();
    dragging = true; clearTimeout(hideTimer);
    geo = measure();
    startY = e.clientY; startTop = root().scrollTop;
    thumb.classList.add('drag', 'show');
    thumb.setPointerCapture(e.pointerId);
  });
  thumb.addEventListener('pointermove', function (e) {
    if (!dragging || !geo || geo.run <= 0) return;
    var next = startTop + (e.clientY - startY) * (geo.max / geo.run);
    root().scrollTop = Math.max(0, Math.min(geo.max, next));
    place();
  });
  function drop(e) {
    if (!dragging) return;
    dragging = false;
    thumb.classList.remove('drag');
    try { thumb.releasePointerCapture(e.pointerId); } catch (err) { }
    hideTimer = setTimeout(function () { thumb.classList.remove('show'); }, HIDE_MS);
  }
  thumb.addEventListener('pointerup', drop);
  thumb.addEventListener('pointercancel', drop);
})();
