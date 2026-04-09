import React from 'react';
import { useGame } from '../context/GameContext.jsx';
import Navbar from '../components/Navbar.jsx';
import PlayerCard from '../components/PlayerCard.jsx';
import CountdownOverlay from '../components/CountdownOverlay.jsx';

export default function WaitingScreen() {
  const { state, emit } = useGame();
  const { users, maxUserCnt, roomName, roomId, countdown, countdownSub, mySocketId } = state;

  const readyCount = users.filter(u => u.readyStatus === 'ready').length;
  const totalCount = users.length;
  const pct = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;
  const allReady = totalCount > 0 && readyCount === totalCount;

  function handleReady() {
    emit('ready');
  }

  function handleLeave() {
    if (roomId) emit('leaveRoom', roomId);
  }

  const myUser = users.find(u => u.id === mySocketId);
  const isReady = myUser?.readyStatus === 'ready';

  return (
    <>
      <Navbar />

      <div className="container-fluid py-3">
        {/* 방 헤더 */}
        <div className="room-header mb-3">
          <div className="room-header-top d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <h4 className="mb-0 text-white fw-bold">{roomName}</h4>
              <span className="badge bg-primary">{totalCount} / {maxUserCnt}</span>
            </div>
            <button className="btn btn-sm btn-outline-light" onClick={handleLeave}>
              <i className="icon ion-log-out me-1" />나가기
            </button>
          </div>

          {/* 대기 상태 바 */}
          <div className="waiting-status-bar mt-2">
            <div className="d-flex align-items-center gap-2 mb-1">
              <div className={`waiting-dot ${allReady ? 'all-ready' : ''}`} />
              <span className="text-white-75 small">
                {allReady ? '모든 플레이어 준비완료!' : `${readyCount}명 준비 완료 (${totalCount - readyCount}명 대기)`}
              </span>
              <span className="badge bg-secondary ms-auto">{readyCount} / {totalCount} 준비</span>
            </div>
            <div className="ready-progress-bar">
              <div
                className="ready-progress-fill"
                style={{ width: `${pct}%`, transition: 'width 0.4s ease' }}
              />
            </div>
          </div>
        </div>

        {/* 플레이어 목록 */}
        <div className="player-grid mb-3">
          {users.map(player => (
            <PlayerCard
              key={player.id}
              player={player}
              isMe={player.id === mySocketId}
            />
          ))}
          {/* 빈 슬롯 */}
          {Array.from({ length: Math.max(0, maxUserCnt - users.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="player-card empty">
              <div className="player-info">
                <div className="player-avatar" style={{ opacity: 0.3 }}>?</div>
                <div className="player-details">
                  <h6 className="text-muted">대기 중...</h6>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 준비 버튼 */}
        <div className="d-flex justify-content-center gap-3">
          <button
            className={`btn btn-lg ${isReady ? 'btn-warning' : 'btn-success'}`}
            onClick={handleReady}
            style={{ minWidth: 140 }}
          >
            {isReady
              ? <><i className="icon ion-pause me-2" />준비 취소</>
              : <><i className="icon ion-checkmark me-2" />Ready</>
            }
          </button>
        </div>

        <p className="text-center text-white-50 small mt-3">
          {totalCount >= 2
            ? '모든 플레이어가 준비하면 게임이 시작됩니다.'
            : '최소 2명이 필요합니다.'}
        </p>
      </div>

      <CountdownOverlay value={countdown} sub={countdownSub} />
    </>
  );
}
