import React from 'react';
import ReactDOM from 'react-dom/client';
import { GameProvider } from './context/GameContext.jsx';
import App from './App.jsx';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <GameProvider>
    <App />
  </GameProvider>
);
