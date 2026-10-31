import React from 'react';
import ReactDOM from 'react-dom/client';
import { GameProvider } from './context/GameContext.jsx';
import App from './App.jsx';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles/app.css';
import './styles/brand.css';
import { getSavedTheme, applyTheme } from './theme/themes.js';
import { unlockAudio } from './fx/sound.js';
import { applyFxStyle } from './fx/style.js';

// 저장된 테마 적용 (깜빡임 방지를 위해 렌더 전에 실행)
applyTheme(getSavedTheme());
applyFxStyle();

// 모바일 브라우저는 사용자 조작 안에서만 오디오를 시작할 수 있다. 조작이 있을 때마다 (멈춰 있으면) 다시 깨운다.
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, unlockAudio, { passive: true, capture: true }));

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
