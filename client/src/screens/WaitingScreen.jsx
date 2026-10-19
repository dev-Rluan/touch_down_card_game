import React from 'react';
import { useGame } from '../context/GameContext.jsx';
import Navbar from '../components/Navbar.jsx';
import PlayerCard from '../components/PlayerCard.jsx';
import CountdownOverlay from '../components/CountdownOverlay.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import Icon from '../components/Icon.jsx';
import HowToPlay from '../components/HowToPlay.jsx';

export default function WaitingScreen() {
  const { state, emit, dispatch } = useGame();
  const { users, maxUserCnt, isPrivate, roomName, roomId, countdown, countdownSub, mySocketId } = state;

  const readyCount = users.filter(u => u.readyStatus === 'ready').length;
  const totalCount = users.length;
  const pct = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;
  const allReady = totalCount > 0 && readyCount === totalCount;

  function handleReady() {
    emit('ready');
  }

  // 초대 링크: 폰은 공유 창(카톡 등), PC 는 복사. 둘 다 안 되면 직접 복사하도록 링크를 보여 준다
  async function handleInvite() {
    const url = `${window.location.origin}/?room=${roomId}`;
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: 'Touch Down', text: `"${roomName}" 방에서 같이 해요!`, url });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return; // 사용자가 공유 창을 닫음
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      dispatch({ type: 'SHOW_NOTIFICATION', message: '초대 링크를 복사했어요. 친구에게 붙여넣기 하세요.', notifType: 'success' });
    } catch (_) {
      window.prompt('이 링크를 복사해 친구에게 보내세요', url);
    }
  }

  function handleLeave() {
    if (roomId) emit('leaveRoom', roomId);
  }

  const myUser = users.find(u => u.id === mySocketId);
  const isReady = myUser?.readyStatus === 'ready';

  return (
    <>
      <Navbar />

      <div className="container-fluid py-3 waiting-layout">
        <div className="waiting-main">
        {/* 방 헤더 */}
        <div className="room-header mb-3">
          <div className="room-header-top d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <h4 className="mb-0 text-white fw-bold">{roomName}</h4>
              <span className="badge bg-primary">{totalCount} / {maxUserCnt}</span>
              {isPrivate && <span className="badge bg-secondary" title="방 목록에 안 보여요. 초대 링크로만 들어올 수 있어요.">비공개</span>}
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-primary" onClick={handleInvite} disabled={totalCount >= maxUserCnt}>
                <Icon name="send" className="me-1" />친구 초대
              </button>
              <button className="btn btn-sm btn-outline-light" onClick={handleLeave}>
                <Icon name="log-out" className="me-1" />나가기
              </button>
            </div>
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
              ? <><Icon name="pause" className="me-2" />준비 취소</>
              : <><Icon name="checkmark" className="me-2" />Ready</>
            }
          </button>
        </div>

        <p className="text-center text-white-50 small mt-3">
          {totalCount >= 2
            ? '모든 플레이어가 준비하면 게임이 시작됩니다.'
            : '최소 2명이 필요합니다.'}
        </p>

        {/* PC 에서만: 왼쪽 아래 빈 공간에 게임 방법 */}
        <HowToPlay className="d-none d-lg-flex mt-4" />

        </div>

        <div className="chat-wrap waiting-chat">
          <ChatPanel variant="inline" />
        </div>
      </div>

      <CountdownOverlay value={countdown} sub={countdownSub} />
    </>
  );
}
