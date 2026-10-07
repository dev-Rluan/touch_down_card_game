import React from 'react';
import ReactDOM from 'react-dom/client';
import { GameProvider } from './context/GameContext.jsx';
import App from './App.jsx';
import './styles/app.css';
import { applyTheme, getStoredTheme } from './theme.js';

// 첫 렌더 전에 저장된 테마 적용 (기본색이 잠깐 보였다 바뀌는 깜빡임 방지)
applyTheme(getStoredTheme());

ReactDOM.createRoot(document.getElementById('root')).render(
  <GameProvider>
    <App />
  </GameProvider>
);
