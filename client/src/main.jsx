import React from 'react';
import ReactDOM from 'react-dom/client';
import { GameProvider } from './context/GameContext.jsx';
import App from './App.jsx';
import './styles/app.css';
import { getSavedTheme, applyTheme } from './theme/themes.js';

// 저장된 테마 적용 (깜빡임 방지를 위해 렌더 전에 실행)
applyTheme(getSavedTheme());

// 이전 버전(바닐라 JS)이 등록한 서비스워커/캐시가 낡은 화면을 계속 보여주지 않도록 제거
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(regs => regs.forEach(r => r.unregister()))
    .catch(() => {});
  if (window.caches) {
    caches.keys()
      .then(keys => keys.filter(k => k.startsWith('tdcg-')).forEach(k => caches.delete(k)))
      .catch(() => {});
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <GameProvider>
    <App />
  </GameProvider>
);
