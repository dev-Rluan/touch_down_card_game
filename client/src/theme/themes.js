// 색 테마 정의 — 실제 색상 값은 app.css 의 [data-theme] 블록에 있고,
// 여기서는 선택 UI 에 필요한 이름/미리보기 색만 가진다.
export const THEMES = [
  { id: 'green',    name: '딥그린',   bg: '#0f2a22', accent: '#f0b429' },
  { id: 'midnight', name: '미드나잇', bg: '#0e1626', accent: '#4fd1c5' },
  { id: 'wine',     name: '와인',     bg: '#2a0f1a', accent: '#ff9f6b' },
  { id: 'charcoal', name: '차콜',     bg: '#16181d', accent: '#ff6b4a' },
];

export const DEFAULT_THEME = 'green';
const STORAGE_KEY = 'td-theme';

export function getSavedTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (THEMES.some(t => t.id === saved)) return saved;
  } catch (_) { /* 저장소 접근 불가 시 기본값 */ }
  return DEFAULT_THEME;
}

export function applyTheme(id) {
  const theme = THEMES.find(t => t.id === id) || THEMES[0];
  document.documentElement.setAttribute('data-theme', theme.id);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.bg);
  try { localStorage.setItem(STORAGE_KEY, theme.id); } catch (_) { /* 무시 */ }
}
