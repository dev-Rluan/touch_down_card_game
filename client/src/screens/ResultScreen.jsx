import React, { useEffect } from 'react';
import { useGame } from '../context/GameContext.jsx';
import AdBanner from '../components/AdBanner.jsx';

function createConfetti() {
  const colors = ['#ff0', '#f0f', '#0ff', '#0f0', '#f00'];
  for (let i = 0; i < 50; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.style.cssText = `
        position: fixed; width: 10px; height: 10px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}vw; top: -10px;
        opacity: 1; pointer-events: none; z-index: 9999;
        animation: confetti 3s linear forwards;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3000);
    }, i * 30);
  }
}

export default function ResultScreen() {
  const { state, emit, dispatch } = useGame();
  const { gameResult, mySocketId } = state;

  const winner = gameResult?.winner;
  const finalScores = gameResult?.finalScores || [];
  const isWinner = winner?.id === mySocketId;

  useEffect(() => {
    document.body.classList.remove('in-game');
    if (isWinner) createConfetti();
  }, [isWinner]);

  function handlePlayAgain() {
    // 같은 방에서 재시작: 대기 화면으로 돌아가기
    dispatch({ type: 'ROOM_JOINED', room: {
      id: state.roomId,
      name: state.roomName,
      users: state.users,
      maxUserCnt: state.maxUserCnt,
    }});
  }

  function handleLobby() {
    if (state.roomId) emit('leaveRoom', state.roomId);
  }

  const sortedScores = [...finalScores].sort((a, b) => (b.cardCount || 0) - (a.cardCount || 0));

  return (
    <div className="container-fluid py-4" style={{ minHeight: '100vh' }}>
      <div className="row justify-content-center">
        <div className="col-lg-6 col-md-8">
          <div className="card text-center mb-3">
            <div className="card-body py-4">
              <div style={{ fontSize: '4rem' }}>{isWinner ? '🏆' : '😢'}</div>
              <h2 className="fw-bold mt-2">{isWinner ? 'VICTORY!' : 'DEFEAT'}</h2>
              <p className="text-muted">{isWinner ? '축하합니다! 승리하셨습니다!' : '다음 기회에...'}</p>
              {winner && <p className="small">우승: <strong>{winner.name}</strong></p>}
            </div>
          </div>

          {/* 최종 점수 */}
          <div className="card mb-3">
            <div className="card-header fw-bold">최종 점수</div>
            <div className="card-body p-0">
              {sortedScores.map((player, i) => (
                <div
                  key={player.id}
                  className={`score-item d-flex align-items-center gap-2 p-2 border-bottom ${player.id === winner?.id ? 'bg-warning bg-opacity-10' : ''}`}
                >
                  <span style={{ width: 24, textAlign: 'center' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </span>
                  <span className="flex-grow-1 fw-semibold">{player.name}</span>
                  <span className="text-muted small">{player.cardCount || 0}장</span>
                  <span className="badge bg-primary">{player.score}점</span>
                  {player.id === mySocketId && <span className="badge bg-info">나</span>}
                </div>
              ))}
            </div>
          </div>

          {/* AdSense 게임 종료 광고 */}
          <AdBanner slot={window.__ADSENSE_GAME_END_SLOT__} className="mb-3" />

          <div className="d-flex gap-2 justify-content-center">
            <button className="btn btn-success" onClick={handlePlayAgain}>
              <i className="icon ion-refresh me-2" />다시 하기
            </button>
            <button className="btn btn-outline-light" onClick={handleLobby}>
              <i className="icon ion-home me-2" />로비로
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
