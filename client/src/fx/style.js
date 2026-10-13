// 이펙트·효과음 스타일 — 두 가지를 실제로 플레이해 보고 고르기 위해 둘 다 제공한다.
//  - classic: 화려하게 (번쩍임, 빛나는 테두리, 전자음)
//  - stack  : 통통 (Stacklands 풍 — 카드가 물건처럼 튀고, 부드러운 나무/종이 소리)
const STORAGE_KEY = 'td-fx-style';

export const FX_STYLES = [
  { id: 'classic', name: '화려하게' },
  { id: 'stack', name: '통통 (스택랜드풍)' },
];

const DEFAULT_STYLE = 'classic';
let current = read();
const listeners = new Set();

function read() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (FX_STYLES.some(s => s.id === saved)) return saved;
  } catch (_) { /* 저장소 접근 불가 */ }
  return DEFAULT_STYLE;
}

export function getFxStyle() {
  return current;
}

/** CSS 가 스타일별 애니메이션을 고르도록 <html data-fx-style> 에 반영 */
export function applyFxStyle(id = current) {
  current = FX_STYLES.some(s => s.id === id) ? id : DEFAULT_STYLE;
  document.documentElement.setAttribute('data-fx-style', current);
}

export function setFxStyle(id) {
  applyFxStyle(id);
  try { localStorage.setItem(STORAGE_KEY, current); } catch (_) { /* 무시 */ }
  listeners.forEach(fn => fn(current));
}

export function subscribeFxStyle(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
