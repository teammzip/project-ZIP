/* 다음 월세 납부일 계산 */
import { today } from './utils.js';
import { settings } from './state.js';

// 오늘 이후 가장 가까운 월세 납부일 (납부일이 31일인데 달이 짧으면 그 달의 마지막 날로 맞춤)
export function nextRentDate() {
  var base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  function clamp(y, m) { var last = new Date(y, m + 1, 0).getDate(); return new Date(y, m, Math.min(settings.rentDay, last)); }
  var c = clamp(base.getFullYear(), base.getMonth());
  if (c < base) c = clamp(base.getFullYear(), base.getMonth() + 1);
  return c;
}
