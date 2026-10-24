# variants/app — 앱 본체 시안 (HTML/CSS/JS)

`index.html` 한 장에 모든 화면(`#view-*`)과 창(모달)이 들어 있고, 보이는 화면은 `js/core/router.js` 가 바꿉니다.
스타일은 `index.html` 의 `<link>` **순서대로** 적용됩니다 (CSS는 순서가 우선순위라 순서를 바꾸지 마세요).

## 화면 → 파일

| 화면 / 기능 | HTML (index.html 안) | JS | CSS |
|---|---|---|---|
| 홈 | `#view-home` | `js/views/dashboard.js`, `js/components/home-noti.js`(알림), `js/views/memo.js`(홈 메모) | `css/views/dashboard.css`, `css/views/memo.css` |
| 홈 "AI와 대화" | `.home-ai`, `#aiChatModal` | `js/components/ai-chat.js` | `css/ai-chat.css`, `css/chat-summary.css` |
| 월세 | `#view-rent` | `js/views/rent.js`, `js/core/rentdate.js` | `css/views/life.css`, `css/finance.css` |
| 공과금 | `#view-bills` | `js/views/bills.js` | `css/views/life.css`, `css/finance.css` |
| 수입 / 기타 지출 | `#view-income` / `#view-spend` | `js/views/income.js` / `spend.js` | `css/finance.css` |
| 일정(캘린더) | `#view-calendar` | `js/views/calendar.js`, `js/data/ev-presets.js`, `js/data/trash.js` | `css/views/calendar.css` |
| 메모 | `#view-memo` | `js/views/memo.js` | `css/views/memo.css` |
| 알림 | `#view-noti` | `js/views/noti.js` | `css/views/noti.css` |
| 내 정보 | `#view-settings` | `js/views/settings.js`, `js/components/account.js` | `css/views/settings.css`, `css/pw-form.css`, `css/confirm-modal.css` |
| AI 도우미 | `#view-ai` | `js/views/ai.js` | `css/views/ai.css` |
| 동네 지도 | `#view-map` | `js/views/map.js`, `js/data/places.js` | `css/views/map.css` |
| 커뮤니티 | `#view-community` | `js/views/community.js`, `js/data/posts-seed.js` | `css/views/community.css` |
| 사이드바 · 하단 메뉴 · ☰ 메뉴 | `.sidebar`, `.menu-panel` | `js/components/shell.js`, `menu-panel.js`, `profile-menu.js` | `css/layout.css`, `css/nav.css` |
| 마이페이지 탭 머리말 | 마이페이지 머리말 | `js/components/shell.js` | `css/my-tabs.css` |
| 경고 안내 창 | `#warnModal` | `js/components/warn-notice.js` (`?demo=warn` 로 예시) | `css/warn-modal.css` |

## 공통
- 시작점: `js/main.js` — 각 화면 파일을 불러옵니다.
- 데이터: `js/core/state.js`(앱 데이터), `js/core/storage.js`(localStorage, 나중에 서버 API로 교체할 자리), `js/data/demo.js`(예시 기록).
- 공통 스타일: `css/base.css`(변수·버튼·카드·폼), `css/layout.css`(전체 격자).
- `../../shared/` — 비밀번호 보관(`zip-password.js`), 이용 정지 기록(`zip-ban.js`), 모바일 스크롤바(`mobile-scroll.*`).
