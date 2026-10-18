/* 시작점: 화면 파일들을 불러오고(각 파일이 자기 이벤트와 화면 등록을 처리), 처음 한 번 그린다. */
import { initRouter } from './core/router.js';
import { applySettings } from './components/shell.js';
import './views/dashboard.js';
import { renderCalendarAll } from './views/calendar.js';
import './views/noti.js';
import './views/ai.js';
import './views/map.js';
import './views/community.js';
import './views/settings.js';
import { renderBills } from './views/bills.js';
import { renderTrash } from './views/trash.js';
import './views/rent.js';
import { renderFixed } from './views/fixed.js';
import { renderSpend } from './views/spend.js';
import { renderIncome } from './views/income.js';
import './components/menu-panel.js';
import './components/ai-chat.js';
import './components/account.js';

// 처음 한 번 화면을 그림: 메뉴 연결 → 설정 반영 → 각 화면의 내용
initRouter();
applySettings();
renderCalendarAll();
renderBills();
renderTrash();
renderFixed();
renderSpend();
renderIncome();
