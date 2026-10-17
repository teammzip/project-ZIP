/* 지도: OpenStreetMap iframe + 예시 장소 목록 */
import { $, el } from '../core/utils.js';
import { PLACES } from '../data/places.js';
import { registerView } from '../core/router.js';

var mapCat = '세탁방', mapIdx = 0, mapReady = false;

function setMap(p) {
  var b = [p.lon - 0.004, p.lat - 0.0025, p.lon + 0.004, p.lat + 0.0025].join('%2C');
  $('mapFrame').src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + b + '&layer=mapnik&marker=' + p.lat + '%2C' + p.lon;
  $('mapBig').href = 'https://www.openstreetmap.org/?mlat=' + p.lat + '&mlon=' + p.lon + '#map=17/' + p.lat + '/' + p.lon;
}
function renderPlaces() {
  var chips = $('mapChips'); chips.textContent = '';
  Object.keys(PLACES).forEach(function (c) {
    var b = el('button', 'chip' + (c === mapCat ? ' on' : ''), c);
    b.type = 'button';
    b.addEventListener('click', function () { mapCat = c; mapIdx = 0; renderPlaces(); setMap(PLACES[c][0]); });
    chips.appendChild(b);
  });
  var box = $('placeList'); box.textContent = '';
  PLACES[mapCat].forEach(function (p, i) {
    var row = el('div', 'place' + (i === mapIdx ? ' on' : ''));
    var t = el('div');
    t.appendChild(el('b', null, p.n));
    t.appendChild(el('small', null, p.d));
    row.appendChild(t);
    row.addEventListener('click', function () { mapIdx = i; renderPlaces(); setMap(p); });
    box.appendChild(row);
  });
}
function initMap() { renderPlaces(); if (!mapReady) { mapReady = true; setMap(PLACES[mapCat][0]); } }

/* AI 화면의 "지도에서 보기"가 쓴다: 다음에 지도를 열 때 이 종류의 첫 장소로 시작 */
export function focusCategory(key) { mapCat = key; mapIdx = 0; mapReady = false; }

registerView('map', initMap);
