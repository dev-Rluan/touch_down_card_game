/**
 * 색 테마 — <html data-theme="..."> 로 CSS 변수(app.css)를 바꿔 끼운다.
 * 선택값은 브라우저(localStorage)에 저장되어 다음 접속에도 유지된다.
 */
export const THEMES = [
  { id: 'violet', label: '보라', colors: ['#667eea', '#764ba2'], meta: '#6366f1' },
  { id: 'ocean', label: '바다', colors: ['#2193b0', '#1e3c72'], meta: '#0284c7' },
  { id: 'forest', label: '숲', colors: ['#3a7d44', '#1b4332'], meta: '#16a34a' },
  { id: 'sunset', label: '노을', colors: ['#ff7e5f', '#b0306a'], meta: '#e11d48' },
  { id: 'night', label: '밤', colors: ['#1e293b', '#0f172a'], meta: '#0f172a' },
];

export const DEFAULT_THEME = 'violet';
const STORAGE_KEY = 'tdcg.theme';

function isValid(id) {
  return THEMES.some(t => t.id === id);
}

export function getStoredTheme() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isValid(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(id) {
  const themeId = isValid(id) ? id : DEFAULT_THEME;
  document.documentElement.dataset.theme = themeId;
  const meta = document.querySelector('meta[name="theme-color"]');
  const theme = THEMES.find(t => t.id === themeId);
  if (meta && theme) meta.setAttribute('content', theme.meta);
  return themeId;
}

export function saveTheme(id) {
  const themeId = applyTheme(id);
  try {
    window.localStorage.setItem(STORAGE_KEY, themeId);
  } catch {
    // 시크릿 모드 등 저장 불가 환경: 이번 세션에만 적용
  }
  return themeId;
}
