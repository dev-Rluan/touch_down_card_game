import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext.jsx';
import BellButton from '../components/BellButton.jsx';
import ThemePicker from '../components/ThemePicker.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import CountdownOverlay from '../components/CountdownOverlay.jsx';
import Icon from '../components/Icon.jsx';
import SoundToggle from '../components/SoundToggle.jsx';
import PingBadge, { pingLevel } from '../components/PingBadge.jsx';
import CardFace from '../components/CardFace.jsx';
import { onFx } from '../fx/fxBus.js';
import { playSound, vibrate } from '../fx/sound.js';
import { deckToStack, sweepTo, failToDiscard, floatText, flash } from '../fx/effects.js';

function PlayerStack({ playerId, playerName, cards, isCurrentTurn, isMe, cardCount, eliminated, bellRank, children }) {
  return (
    <div
      className={`player-stack ${isCurrentTurn ? (isMe ? 'my-turn' : 'other-turn') : ''} ${eliminated ? 'eliminated' : ''}`}
      data-stack-id={playerId}
    >
      <div className="player-stack-header">
        <span className="player-stack-name">{playerName}</span>
        {eliminated
          ? <span className="turn-badge out-badge">탈락</span>
          : <span className="player-stack-count">🃏 {cardCount ?? cards.length}</span>}
        {isCurrentTurn && !eliminated && (
          <span className={`turn-badge ${isMe ? 'my-turn-badge' : 'other-turn-badge'}`}>
            {isMe ? '내 턴' : '상대 턴'}
          </span>
        )}
      </div>
      {bellRank && <span className={`bell-rank bell-rank-${Math.min(bellRank, 4)}`} aria-label={`벨 ${bellRank}번째`}>{bellRank}</span>}
      <div className="player-stack-content">
        <div className="player-stack-cards">
          {cards.length === 0 ? (
            <div className="stack-placeholder">{eliminated ? '탈락' : '대기중'}</div>
          ) : (
            cards.map((card, i) => (
              <div key={card._k ?? i} className="stack-card" style={{ zIndex: i }} aria-hidden={i !== cards.length - 1}>
                <CardFace fruit={card.fruit} count={card.count} />
              </div>
            ))
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

// 벨 누른 순서 (서버가 받은 순서). 첫 번째와의 시간 차이를 함께 보여준다
function BellOrder({ order, mySocketId }) {
  if (!order || order.presses.length === 0) return null;
  return (
    <ol className="bell-order" aria-label="벨 누른 순서">
      {order.presses.map(p => (
        <li key={p.playerId} className={p.playerId === mySocketId ? 'me' : ''}>
          <span className={`bell-rank bell-rank-${Math.min(p.rank, 4)}`}>{p.rank}</span>
          <span className="bell-order-name">{p.name}</span>
          {p.rank > 1 && <span className="bell-order-delta">+{(p.delta / 1000).toFixed(2)}초</span>}
          {p.ping != null && <span className={`bell-order-ping ping-${pingLevel(p.ping)}`}>핑 {p.ping}ms</span>}
        </li>
      ))}
    </ol>
  );
}

function MyDeckCard({ count, onPlay, disabled, eliminated }) {
  if (count === 0) {
    return (
      <div className={`deck-card empty ${eliminated ? 'deck-out' : ''}`}>
        <span className="deck-empty-label">{eliminated ? '탈락' : '덱 비움'}</span>
        {eliminated && <span className="deck-empty-sub">관전 중</span>}
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
      <div className="deck-count">{count}장</div>
      <div className="deck-hint">{disabled ? '상대 턴' : '클릭하여 플레이'}</div>
    </button>
  );
}

export default function GameScreen() {
  const { state, emit } = useGame();
  const {
    mySocketId, handCount, playerStacks, gameStatePlayers,
    currentTurn, discardedCount, halliGalliResult,
    countdown, countdownSub, users, isMyTurn, roomId, chatUnread, bellOrder,
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

    if (type === 'bellError') {
      const msg = data?.message || '';
      const short = msg.includes('1초') ? '잠깐!' : msg.includes('탈락') ? '탈락' : msg.includes('늦었') ? '늦었어요!' : '';
      if (short) floatText(me, short, 'bad');
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
  const mySeat = Math.max(0, players.findIndex(player => player.id === mySocketId));

  // 카드를 모두 잃은 플레이어 = 탈락 (서버도 벨/차례에서 제외한다)
  const inGame = gameStatePlayers.length > 0;
  const isOut = (p) => inGame && (p.cardCount ?? 0) === 0;
  const meOut = inGame && isOut(players.find(p => p.id === mySocketId) || { cardCount: 1 });
  const rankOf = Object.fromEntries((bellOrder?.presses || []).map(p => [p.playerId, p.rank]));

  // 누군가 방금 탈락하면 그 더미 위에 "탈락" 표시
  const prevCounts = useRef({});
  useEffect(() => {
    if (!inGame) return;
    players.forEach(p => {
      const prev = prevCounts.current[p.id];
      if (prev > 0 && p.cardCount === 0) {
        setTimeout(() => floatText(p.id, '탈락', 'bad'), 500); // 벨 실패 글자와 겹치지 않게 조금 뒤에
        if (p.id === mySocketId) vibrate([80, 60, 80]);
      }
      prevCounts.current[p.id] = p.cardCount;
    });
  });

  // PC 화면에서 카드 크기를 인원수에 맞춰 계산하도록 CSS 에 인원수를 넘긴다 (이펙트 레이어도 쓰므로 body 에 둔다)
  useEffect(() => {
    document.body.style.setProperty('--players', String(Math.max(players.length, 2)));
    return () => document.body.style.removeProperty('--players');
  }, [players.length]);

  return (
    <div className="game-board table-layout" data-player-count={players.length}>
      <header className="game-toolbar">
        <div className="game-toolbar-brand">
          <img src="/public/brand/pebblecraft-mark.svg" alt="" width="32" height="32" />
          <span>Touch Down <small>{players.length}인 플레이</small></span>
        </div>
        <p className="game-toolbar-status">
          {isMyTurn ? '내 차례입니다' : `${players[currentTurn]?.name ?? '친구'}님의 차례`}
        </p>
        <div className="game-toolbar-actions">
          <button className="btn btn-sm btn-outline-light" onClick={handleLeave}>
            <Icon name="log-out" className="me-1" />나가기
          </button>
          <button
            className="btn btn-sm btn-outline-light chat-fab"
            onClick={() => setShowChat(v => !v)}
            aria-label="채팅 열기"
          >
            <Icon name="chat" /><span className="chat-fab-label">채팅</span>
            {chatUnread > 0 && !showChat && <span className="chat-badge">{chatUnread > 9 ? '9+' : chatUnread}</span>}
          </button>
          <PingBadge />
          <SoundToggle />
          <ThemePicker />
        </div>
      </header>

      <section className="game-table" aria-label="플레이 테이블">
        <div className="player-stacks-area">
          <div id="playerStacks" className={`${players.length > 2 ? 'stacks-many' : ''} ${players.length > 4 ? 'stacks-crowd' : ''}`}>
            {players.map((player, idx) => {
              const stack = playerStacks[player.id] || { cards: [] };
              const isCurrentTurn = idx === currentTurn;
              const isMe = player.id === mySocketId;
              return (
                <div className="table-seat" data-seat={(idx - mySeat + players.length) % players.length} data-self={isMe} key={player.id}>
                  <PlayerStack
                    playerId={player.id}
                    playerName={player.name}
                    cards={stack.cards}
                    isCurrentTurn={isCurrentTurn}
                    isMe={isMe}
                    cardCount={player.cardCount}
                    eliminated={isOut(player)}
                    bellRank={rankOf[player.id]}
                  >
                    {isMe && (
                      <div className="player-section">
                        <div className="game-actions">
                          <div className="text-center">
                            <div className="small text-white-50 mb-1">내 덱</div>
                            <MyDeckCard count={handCount} onPlay={handlePlayCard} disabled={!isMyTurn} eliminated={meOut} />
                          </div>
                        </div>
                      </div>
                    )}
                  </PlayerStack>
                </div>
              );
            })}
          </div>
        </div>

        <div className="table-center">
          <BellOrder order={bellOrder} mySocketId={mySocketId} />
          <BellButton eliminated={meOut} />
          <div className="discard-area">
            <div className="discard-pile-container text-center">
              <div className="small text-muted mb-1">버림 <span id="discardCount">{discardedCount}장</span></div>
              {/* 버린 카드는 뒤집어 놓은 카드: 내용은 모르고 장수만 보인다 */}
              <div id="discardPile" className={`discard-pile ${discardedCount > 0 ? 'face-down' : 'empty-discard'}`} data-count={Math.min(discardedCount, 3)}>
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
          </div>
        </div>
      </section>

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
