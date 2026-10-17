/* 대시보드(기존 홈): 정적인 부분이 대부분이라 연결할 동작만 있다.
 * 할 일·공과금·쓰레기·월세 카드의 내용은 각 화면 파일(todo, bills, trash, rent)이 그린다. */
import { openTipDetail } from './community.js';

// 꿀팁 글 줄: 누르면 커뮤니티의 해당 글 상세로
document.querySelectorAll('[data-tip-id]').forEach(function (a) {
  a.addEventListener('click', function (e) {
    e.preventDefault();
    openTipDetail(a.getAttribute('data-tip-id'));
  });
});

// 요약 카드(role=button)는 Enter/Space로도 열리게
document.querySelectorAll('.stat[data-go]').forEach(function (a) {
  a.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); a.click(); } });
});
