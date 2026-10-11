import React from 'react';
import { useGame } from '../context/GameContext.jsx';

// 서버 연결 중 화면 — 연결되면 자동으로 로비로 전환된다 (임시 닉네임 부여)
export default function LoadingScreen() {
  const { state } = useGame();

  return (
    <div className="intro-screen">
      <div className="intro-content">
        <div className="intro-logo">
          <h1 className="intro-title">Touch Down</h1>
          <p className="intro-subtitle">온라인 멀티플레이 카드게임</p>
        </div>

        <div className="intro-status">
          {state.connectError ? (
            <>
              <p className="text-danger small mb-2">서버에 연결하지 못했습니다.</p>
              <button className="btn intro-btn intro-btn-guest" onClick={() => window.location.reload()}>
                다시 시도
              </button>
            </>
          ) : (
            <span className="small" style={{ color: 'var(--ink-dim)' }}>
              <span className="spinner-border spinner-border-sm me-2" style={{ width: '0.8rem', height: '0.8rem' }} />
              접속 중...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
