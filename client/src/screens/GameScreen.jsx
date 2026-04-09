import React, { useEffect } from 'react';
import { useGame } from '../context/GameContext.jsx';
import BellButton from '../components/BellButton.jsx';
import CountdownOverlay from '../components/CountdownOverlay.jsx';

const FRUIT_EMOJI = {
  strawberry: '🍓',
  banana: '🍌',
  plum: '🍇',
  lemon: '🍋',
};

function getFruitEmoji(fruit) {
  return FRUIT_EMOJI[fruit] || '🃏';
}

function PlayerStack({ playerId, playerName, cards, isCurrentTurn, isMe, cardCount }) {
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
              <div style={{ fontSize: 36 }}>{getFruitEmoji(card.fruit)}</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#333' }}>{card.count}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MyDeckCard({ cards, onPlay }) {
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
      aria-label="카드 내기"
    >
      <div className="card-back-pattern" />
      <div style={{ position: 'relative', zIndex: 1, color: '#fbbf24', fontSize: 16, fontWeight: 'bold', textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>
        {cards.length}장
      </div>
      <div style={{ position: 'relative', zIndex: 1, color: '#fde047', fontSize: 12, marginTop: 6, fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
        클릭하여 플레이
      </div>
    </button>
  );
}

export default function GameScreen() {
  const { state, emit, dispatch } = useGame();
  const {
    mySocketId, hand, playerStacks, gameStatePlayers,
    currentTurn, discardedCards, halliGalliResult,
    countdown, countdownSub, users,
  } = state;

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

  const topCard = discardedCards.length > 0 ? discardedCards[discardedCards.length - 1] : null;

  // 코스메틱 벨 스킨
  const bellSkinClass = state.account
    ? (state.account.cosmetics?.equipped?.bell ? state.account.cosmetics.equipped.bell.replace('bell-', 'bell-skin-') : '')
    : '';

  return (
    <div className="game-board d-flex flex-column" style={{ minHeight: '100vh' }}>
      {/* 상단 플레이어 스택 영역 */}
      <div className="player-stacks-area flex-grow-1">
        <div id="playerStacks" className="d-flex flex-wrap gap-3 justify-content-center p-3">
          {players.map((player, idx) => {
            const stack = playerStacks[player.id] || { cards: [] };
            const isCurrentTurn = idx === currentTurn;
            const isMe = player.id === mySocketId;
            return (
              <PlayerStack
                key={player.id}
                playerId={player.id}
                playerName={player.name}
                cards={stack.cards}
                isCurrentTurn={isCurrentTurn}
                isMe={isMe}
                cardCount={player.cardCount}
              />
            );
          })}
        </div>

        {/* 버림 카드 더미 */}
        <div className="discard-area d-flex justify-content-center mb-2">
          <div className="discard-pile-container text-center">
            <div className="small text-muted mb-1">버림 카드 더미 <span id="discardCount">{discardedCards.length}장</span></div>
            <div id="discardPile" className="discard-pile">
              {topCard ? (
                <>
                  <div className="discard-card">{getFruitEmoji(topCard.fruit)}</div>
                  <div className="discard-card-count">{topCard.count}</div>
                </>
              ) : (
                <div className="discard-placeholder">버림 카드 없음</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 하단 액션 영역 */}
      <div className="player-section p-3">
        <div className="d-flex justify-content-center align-items-end gap-4 flex-wrap">
          {/* 내 덱 */}
          <div className="text-center">
            <div className="small text-white-50 mb-1">내 덱</div>
            <MyDeckCard cards={hand} onPlay={handlePlayCard} />
          </div>

          {/* 벨 버튼 */}
          <BellButton skinClass={bellSkinClass} />
        </div>
      </div>

      {/* 할리갈리 결과 알림 */}
      {halliGalliResult && (
        <div className={`halli-galli-notification ${halliGalliResult.success ? 'success show' : 'failure show'}`}>
          <div className="notification-icon">{halliGalliResult.success ? '🎉' : '❌'}</div>
          <div className="notification-text">
            <strong>
              {halliGalliResult.playerName}님이 할리갈리 {halliGalliResult.success ? '성공!' : '실패!'}
            </strong>
            {halliGalliResult.success && (
              <div className="notification-score">+{halliGalliResult.scoreGained}점 획득!</div>
            )}
          </div>
        </div>
      )}

      <CountdownOverlay value={countdown} sub={countdownSub} />
    </div>
  );
}
