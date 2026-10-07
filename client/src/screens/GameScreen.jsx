import React, { useEffect, useState, memo } from 'react';
import { useGame } from '../context/GameContext.jsx';
import BellButton from '../components/BellButton.jsx';
import CountdownOverlay from '../components/CountdownOverlay.jsx';

const FRUIT_EMOJI = {
  strawberry: '🍓',
  banana: '🍌',
  plum: '🍇',
  lemon: '🍋',
};

const EMPTY_STACK = { cards: [] };

function getFruitEmoji(fruit) {
  return FRUIT_EMOJI[fruit] || '🃏';
}

const PlayerStack = memo(function PlayerStack({ playerName, cards, isCurrentTurn, isMe, cardCount, score, isOut }) {
  const turnClass = isCurrentTurn ? (isMe ? 'my-turn' : 'other-turn') : '';
  return (
    <div className={`player-stack ${turnClass} ${isMe ? 'is-me' : ''} ${isOut ? 'is-out' : ''}`}>
      <div className="player-stack-header">
        <span className="player-stack-name" title={playerName}>
          {playerName}{isMe && <span className="me-tag">나</span>}
        </span>
        <span className="player-stack-count" title="남은 카드">🃏 {cardCount ?? cards.length}</span>
        {typeof score === 'number' && score > 0 && (
          <span className="player-stack-score" title="획득 점수">⭐ {score}</span>
        )}
        {isCurrentTurn && (
          <span className={`turn-badge ${isMe ? 'my-turn-badge' : 'other-turn-badge'}`}>
            {isMe ? '내 턴' : '차례'}
          </span>
        )}
      </div>
      <div className="player-stack-cards">
        {isOut ? (
          <div className="stack-placeholder">탈락</div>
        ) : cards.length === 0 ? (
          <div className="stack-placeholder">대기중</div>
        ) : (
          cards.map((card, i) => (
            <div
              key={`${i}-${card.fruit}-${card.count}`}
              className={`stack-card ${i === cards.length - 1 ? 'top-card' : ''}`}
              style={{ zIndex: i }}
              aria-label={`${card.fruit} ${card.count}개`}
            >
              <div className="stack-card-fruit">{getFruitEmoji(card.fruit)}</div>
              <div className="stack-card-count">{card.count}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

function MyDeckCard({ count, canPlay, onPlay }) {
  if (count === 0) {
    return (
      <div className="deck-card empty">
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>덱 비움</span>
      </div>
    );
  }

  return (
    <button
      className={`deck-card my-deck-card card-back style-pattern ${canPlay ? 'can-play' : 'waiting-turn'}`}
      onClick={onPlay}
      disabled={!canPlay}
      aria-label={canPlay ? '카드 내기' : '내 차례가 아닙니다'}
    >
      <div className="card-back-pattern" />
      <div className="deck-card-count">{count}장</div>
      <div className="deck-card-hint">{canPlay ? '탭하여 카드 내기' : '차례 대기중'}</div>
    </button>
  );
}

export default function GameScreen() {
  const { state, emit } = useGame();
  const {
    mySocketId, hand, playerStacks, gameStatePlayers,
    currentTurn, discardedCards, halliGalliResult,
    countdown, countdownSub, users, isMyTurn, centerCardCount,
  } = state;
  // 카드 낸 직후 서버 응답(cardPlayed) 전까지 중복 탭 방지
  const [playPending, setPlayPending] = useState(false);

  useEffect(() => {
    setPlayPending(false);
  }, [currentTurn, hand.length]);

  useEffect(() => {
    if (!playPending) return;
    const t = setTimeout(() => setPlayPending(false), 1500);
    return () => clearTimeout(t);
  }, [playPending]);

  // body.in-game 클래스 토글 (overscroll lock)
  useEffect(() => {
    document.body.classList.add('in-game');
    return () => document.body.classList.remove('in-game');
  }, []);

  const canPlay = isMyTurn && hand.length > 0 && !playPending && countdown === null;

  function handlePlayCard() {
    if (!canPlay) return;
    setPlayPending(true);
    emit('playCard', 0);
  }

  // 플레이어 목록: gameStatePlayers 우선, fallback users
  const players = gameStatePlayers.length > 0 ? gameStatePlayers : users.map(u => ({ ...u, cardCount: 0 }));
  const turnPlayer = players[currentTurn];

  const topCard = discardedCards.length > 0 ? discardedCards[discardedCards.length - 1] : null;

  // 코스메틱 벨 스킨
  const bellSkinClass = state.account
    ? (state.account.cosmetics?.equipped?.bell ? state.account.cosmetics.equipped.bell.replace('bell-', 'bell-skin-') : '')
    : '';

  return (
    <div className="game-board d-flex flex-column" style={{ minHeight: '100vh' }}>
      {/* 턴 안내 — 벨 결과가 있으면 잠시 결과를 대신 표시 (화면 요소를 가리지 않도록 배너 안에서 처리) */}
      {halliGalliResult ? (
        <div
          key={halliGalliResult.receivedAt}
          className={`turn-banner bell-result ${halliGalliResult.success ? 'success' : 'failure'}`}
          role="status"
          aria-live="polite"
        >
          <span>
            {halliGalliResult.success ? '🎉 ' : '❌ '}
            {halliGalliResult.playerId === mySocketId ? '내' : `${halliGalliResult.playerName}님`} 벨 {halliGalliResult.success ? '성공!' : '실패!'}
          </span>
          <span className="turn-banner-sub">
            {halliGalliResult.success
              ? `카드 ${halliGalliResult.scoreGained}장 획득`
              : halliGalliResult.discardedCard ? '카드 1장을 버렸습니다' : '버릴 카드가 없습니다'}
          </span>
        </div>
      ) : (
        <div className={`turn-banner ${isMyTurn ? 'mine' : ''}`} aria-live="polite">
          {isMyTurn
            ? '내 차례! 카드를 내세요'
            : turnPlayer
              ? `${turnPlayer.name}님의 차례`
              : '게임 준비 중...'}
          <span className="turn-banner-sub">중앙 {centerCardCount}장 · 버림 {discardedCards.length}장</span>
        </div>
      )}

      {/* 상단 플레이어 스택 영역 */}
      <div className="player-stacks-area flex-grow-1">
        <div id="playerStacks" className="d-flex flex-wrap gap-3 justify-content-center p-3">
          {players.map((player, idx) => {
            const stack = playerStacks[player.id] || EMPTY_STACK;
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
                score={player.score}
                isOut={player.cardCount === 0 && stack.cards.length === 0}
              />
            );
          })}
        </div>

        {/* 버림 카드 더미 */}
        <div className="discard-area d-flex justify-content-center mb-2">
          <div className="discard-pile-container text-center">
            <div className="small text-white-50 mb-1">버림 카드 더미 <span id="discardCount">{discardedCards.length}장</span></div>
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
            <div className="my-deck-label">내 덱</div>
            <MyDeckCard count={hand.length} canPlay={canPlay} onPlay={handlePlayCard} />
          </div>

          {/* 벨 버튼 */}
          <BellButton skinClass={bellSkinClass} />
        </div>
      </div>

      <CountdownOverlay value={countdown} sub={countdownSub} />
    </div>
  );
}
