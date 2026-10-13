import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext.jsx';
import BellButton from '../components/BellButton.jsx';
import ThemePicker from '../components/ThemePicker.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import CountdownOverlay from '../components/CountdownOverlay.jsx';
import Icon from '../components/Icon.jsx';

const FRUIT_EMOJI = {
  strawberry: '🍓',
  banana: '🍌',
  plum: '🍇',
  lemon: '🍋',
};

function getFruitEmoji(fruit) {
  return FRUIT_EMOJI[fruit] || '🃏';
}

function PlayerStack({ playerName, cards, isCurrentTurn, isMe, cardCount }) {
  return (
    <div className={`player-stack ${isCurrentTurn ? (isMe ? 'my-turn' : 'other-turn') : ''}`}>
      <div className="player-stack-header">
        <span className="player-stack-name">{playerName}</span>
        <span className="player-stack-count">🃏 {cardCount ?? cards.length}</span>
        {isCurrentTurn && (
          <span className={`turn-badge ${isMe ? 'my-turn-badge' : 'other-turn-badge'}`}>
            {isMe ? '내 턴' : '상대 턴'}
          </span>
        )}
      </div>
      <div className="player-stack-cards">
        {cards.length === 0 ? (
          <div className="stack-placeholder">대기중</div>
        ) : (
          cards.map((card, i) => (
            <div key={i} className="stack-card" style={{ zIndex: i }}>
              <div className="stack-fruit">{getFruitEmoji(card.fruit)}</div>
              <div className="stack-count">{card.count}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MyDeckCard({ cards, onPlay, disabled }) {
  if (cards.length === 0) {
    return (
      <div className="deck-card empty">
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>덱 비움</span>
      </div>
    );
  }

  return (
    <button
      className="deck-card my-deck-card card-back style-pattern"
      onClick={onPlay}
      disabled={disabled}
      style={disabled ? { opacity: 0.5, filter: 'grayscale(0.4)', cursor: 'not-allowed' } : undefined}
      aria-label="카드 내기"
    >
      <div className="card-back-pattern" />
      <div style={{ position: 'relative', zIndex: 1, color: '#fbbf24', fontSize: 16, fontWeight: 'bold', textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>
        {cards.length}장
      </div>
      <div style={{ position: 'relative', zIndex: 1, color: '#fde047', fontSize: 12, marginTop: 6, fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
        {disabled ? '상대 턴' : '클릭하여 플레이'}
      </div>
    </button>
  );
}

export default function GameScreen() {
  const { state, emit } = useGame();
  const {
    mySocketId, hand, playerStacks, gameStatePlayers,
    currentTurn, discardedCount, halliGalliResult,
    countdown, countdownSub, users, isMyTurn, roomId, chatUnread,
  } = state;
  const [showChat, setShowChat] = useState(false);

  function handleLeave() {
    if (roomId && window.confirm('게임을 나가시겠습니까?')) emit('leaveRoom', roomId);
  }

  // body.in-game 클래스 토글 (overscroll lock)
  useEffect(() => {
    document.body.classList.add('in-game');
    return () => document.body.classList.remove('in-game');
  }, []);

  function handlePlayCard() {
    emit('playCard', 0);
  }

  // 플레이어 목록: gameStatePlayers 우선, fallback users
  const players = gameStatePlayers.length > 0 ? gameStatePlayers : users.map(u => ({ ...u, cardCount: 0 }));

  return (
    <div className="game-board d-flex flex-column" style={{ minHeight: '100vh' }}>
      {/* 상단 플레이어 스택 영역 */}
      <div className="player-stacks-area flex-grow-1">
        <div id="playerStacks" className={`d-flex flex-wrap justify-content-center ${players.length > 2 ? 'stacks-many' : ''}`}>
          {players.map((player, idx) => {
            const stack = playerStacks[player.id] || { cards: [] };
            const isCurrentTurn = idx === currentTurn;
            const isMe = player.id === mySocketId;
            return (
              <PlayerStack
                key={player.id}
                playerName={player.name}
                cards={stack.cards}
                isCurrentTurn={isCurrentTurn}
                isMe={isMe}
                cardCount={player.cardCount}
              />
            );
          })}
        </div>

        {/* 버림 카드 더미 + 보조 버튼 (왼쪽: 나가기, 오른쪽: 채팅/테마) — 위쪽 헤더 줄을 없애 카드 영역을 올렸다 */}
        <div className="discard-area">
          <div className="discard-side discard-side-left">
            <button className="btn btn-sm btn-outline-light" onClick={handleLeave}>
              <Icon name="log-out" className="me-1" />나가기
            </button>
          </div>

          <div className="discard-pile-container text-center">
            <div className="small text-muted mb-1">버림 카드 더미 <span id="discardCount">{discardedCount}장</span></div>
            {/* 버린 카드는 뒤집어 놓은 카드: 내용은 모르고 장수만 보인다 */}
            <div id="discardPile" className={`discard-pile ${discardedCount > 0 ? 'face-down' : ''}`} data-count={Math.min(discardedCount, 3)}>
              {discardedCount > 0 ? (
                <>
                  <div className="card-back-pattern" />
                  <div className="discard-back-count">{discardedCount}</div>
                </>
              ) : (
                <div className="discard-placeholder">비어 있음</div>
              )}
            </div>
          </div>

          <div className="discard-side discard-side-right">
            <button
              className="btn btn-sm btn-outline-light chat-fab"
              onClick={() => setShowChat(v => !v)}
              aria-label="채팅 열기"
            >
              <Icon name="chat" className="me-1" />채팅
              {chatUnread > 0 && !showChat && <span className="chat-badge">{chatUnread > 9 ? '9+' : chatUnread}</span>}
            </button>
            <ThemePicker />
          </div>
        </div>
      </div>

      {/* 하단 액션 영역 */}
      <div className="player-section p-3">
        <div className="d-flex justify-content-center align-items-end gap-4 flex-wrap">
          {/* 내 덱 */}
          <div className="text-center">
            <div className="small text-white-50 mb-1">내 덱</div>
            <MyDeckCard cards={hand} onPlay={handlePlayCard} disabled={!isMyTurn} />
          </div>

          {/* 벨 버튼 */}
          <BellButton />
        </div>
      </div>

      {/* 벨 결과 알림 */}
      {halliGalliResult && (
        <div className={`halli-galli-notification ${halliGalliResult.success ? 'success show' : 'failure show'}`}>
          <div className="notification-icon">{halliGalliResult.success ? '🎉' : '❌'}</div>
          <div className="notification-text">
            <strong>
              {halliGalliResult.playerName}님이 터치다운 {halliGalliResult.success ? '성공!' : '실패!'}
            </strong>
            {halliGalliResult.success && (
              <div className="notification-score">+{halliGalliResult.scoreGained}점 획득!</div>
            )}
          </div>
        </div>
      )}

      {showChat && <ChatPanel variant="sheet" onClose={() => setShowChat(false)} />}

      <CountdownOverlay value={countdown} sub={countdownSub} />
    </div>
  );
}
