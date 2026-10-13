import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext.jsx';
import BellButton from '../components/BellButton.jsx';
import ThemePicker from '../components/ThemePicker.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import CountdownOverlay from '../components/CountdownOverlay.jsx';
import Icon from '../components/Icon.jsx';
import SoundToggle from '../components/SoundToggle.jsx';
import { onFx } from '../fx/fxBus.js';
import { playSound, vibrate } from '../fx/sound.js';
import { deckToStack, sweepTo, failToDiscard, floatText, flash } from '../fx/effects.js';

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
    <div className={`player-stack ${isCurrentTurn ? (isMe ? 'my-turn' : 'other-turn') : ''}`} data-stack-id={playerId}>
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
            <div key={card._k ?? i} className="stack-card" style={{ zIndex: i }}>
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
      <div className="deck-count">{cards.length}장</div>
      <div className="deck-hint">{disabled ? '상대 턴' : '클릭하여 플레이'}</div>
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

  // 이펙트 리스너는 한 번만 등록하고, 최신 상태는 ref 로 읽는다
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => onFx((type, data) => {
    const { mySocketId: me, gameStatePlayers: players } = latest.current;

    if (type === 'cardPlayed') {
      const count = data?.result?.playedCard?.count || 1;
      playSound('cardPlace', { pitch: 0.9 + count * 0.05 });
      if (data.playerId === me) {
        deckToStack(me);
        vibrate(15);
      }
    }

    if (type === 'halliResult') {
      const mine = data.playerId === me;
      if (data.success) {
        sweepTo(data.playerId);
        flash('good');
        floatText(data.playerId, `터치다운! +${data.scoreGained || 0}`, 'good');
        playSound('bellSuccess');
        if (mine) vibrate([30, 40, 30]);
      } else {
        const hadCards = (players.find(p => p.id === data.playerId)?.cardCount || 0) > 0;
        failToDiscard(data.playerId);
        floatText(data.playerId, hadCards ? '실패 -1' : '실패', 'bad');
        playSound('bellFail');
        if (mine) vibrate([60, 40, 60]);
      }
    }
  }), []);

  // 내 차례가 시작되는 순간: 소리 + 짧은 진동 (덱이 빛나는 효과는 CSS)
  const wasMyTurn = useRef(isMyTurn);
  useEffect(() => {
    if (isMyTurn && !wasMyTurn.current) {
      playSound('myTurn');
      vibrate(25);
    }
    wasMyTurn.current = isMyTurn;
  }, [isMyTurn]);

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

  // PC 화면에서 카드 크기를 인원수에 맞춰 계산하도록 CSS 에 인원수를 넘긴다 (이펙트 레이어도 쓰므로 body 에 둔다)
  useEffect(() => {
    document.body.style.setProperty('--players', String(Math.max(players.length, 2)));
    return () => document.body.style.removeProperty('--players');
  }, [players.length]);

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
              <Icon name="chat" /><span className="chat-fab-label">채팅</span>
              {chatUnread > 0 && !showChat && <span className="chat-badge">{chatUnread > 9 ? '9+' : chatUnread}</span>}
            </button>
            <SoundToggle />
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

      {/* 벨 결과는 이펙트(더미 위 숫자, 카드 이동, 소리)로 보여준다. 화면 낭독기 사용자를 위한 안내만 남긴다 */}
      <div className="visually-hidden" aria-live="polite">
        {halliGalliResult
          ? `${halliGalliResult.playerName}님 터치다운 ${halliGalliResult.success ? `성공, ${halliGalliResult.scoreGained}점` : '실패'}`
          : ''}
      </div>

      {showChat && <ChatPanel variant="sheet" onClose={() => setShowChat(false)} />}

      <CountdownOverlay value={countdown} sub={countdownSub} />
    </div>
  );
}
