import React from 'react';
import { useGame } from '../context/GameContext.jsx';

export default function LoadingScreen() {
  const { state } = useGame();

  return (
    <div className="loading-screen">
      <div className="loading-bell">
        <i className="icon ion-ios-bell" style={{ fontSize: '4rem', color: '#fbbf24' }} />
      </div>
      <h4 className="text-white fw-bold mt-3">Touch Down</h4>
      <div className="loading-dots mt-3">
        <span /><span /><span />
      </div>
      <p id="loadingStatus" className="text-white-50 mt-2 small">
        {state.connectError ? '연결 실패 – 페이지를 새로고침해주세요.' : '서버에 연결 중...'}
      </p>
    </div>
  );
}
