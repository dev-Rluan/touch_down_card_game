const { getRoomById, saveRoomState } = require('./roomService');
const { createDeck, shuffleCards, dealCards, checkHalliGalli, calculateCardSum } = require('../utils/CardUtils');

/**
 * 게임 시작
 * @param {string} roomId - 방 ID
 * @returns {Object} 게임 시작 정보
 */
function playerHasCards(player) {
  return Array.isArray(player.cardPack) && player.cardPack.length > 0;
}

// 각 플레이어 더미의 맨 위 카드 (벨 판정 대상)
function topCardsOf(room) {
  return Object.values(room.gameState.playerStacks)
    .filter(stack => stack.length > 0)
    .map(stack => stack[stack.length - 1]);
}

function markPlayerActiveState(player) {
  player.isActive = playerHasCards(player);
}

function findNextPlayerIndex(room, startIndex) {
  const { users } = room;
  if (!users || users.length === 0) {
    return 0;
  }
  for (let offset = 1; offset <= users.length; offset++) {
    const idx = (startIndex + offset) % users.length;
    const candidate = users[idx];
    if (candidate && playerHasCards(candidate)) {
      return idx;
    }
  }
  return startIndex;
}

function normalizeCurrentTurn(room) {
  if (!room.gameState) return;
  const currentIndex = room.gameState.currentTurn ?? 0;
  const currentPlayer = room.users[currentIndex];
  if (currentPlayer && playerHasCards(currentPlayer)) {
    return;
  }
  room.gameState.currentTurn = findNextPlayerIndex(room, currentIndex);
}

function advanceTurn(room) {
  if (!room.gameState) return;
  const currentIndex = room.gameState.currentTurn ?? 0;
  room.gameState.currentTurn = findNextPlayerIndex(room, currentIndex);
}

const startGame = async (roomId) => {
  const room = await getRoomById(roomId);
  if (!room) {
    throw new Error('방을 찾을 수 없습니다.');
  }

  if (room.users.length < 2) {
    throw new Error('게임을 시작하려면 최소 2명이 필요합니다.');
  }

  // 게임 상태 초기화
  room.status = 'playing';
  room.gameState = {
    phase: 'playing', // playing, finished
    currentTurn: 0,
    centerCards: [], // 전체 중앙 카드 (히스토리용)
    playerStacks: {}, // 각 플레이어별 카드 스택 { playerId: [cards] }
    discardedCards: [], // 할리갈리 실패 시 버린 카드들
    boardSeq: 0, // 바닥 번호: 카드가 나오거나 벨 성공으로 바닥이 비워질 때마다 +1 (벨 시간 보정용)
    prevTopCards: null, // 마지막 카드가 나오기 직전의 맨 위 카드들
    lastPlayAt: 0, // 마지막 카드가 나온 서버 시각
    gameStartTime: new Date().toISOString(),
    lastActionTime: new Date().toISOString()
  };

  // 각 플레이어의 카드 스택 초기화
  room.users.forEach(user => {
    room.gameState.playerStacks[user.id] = [];
  });

  // 카드 덱 생성 및 셔플
  const deck = shuffleCards(createDeck());
  // 카드 분배
  const dealtCards = dealCards(room.users, deck);

  // 각 플레이어에게 카드 할당 및 상태 변경
  room.users.forEach(user => {
    user.cardPack = dealtCards[user.id] || [];
    user.score = 0;
    user.isActive = true;
    user.readyStatus = 'playing'; // 게임중 상태로 변경
  });

  // 남은 덱(기록 용도) 저장: 분배 후 각 플레이어 카드 수 총합을 제외한 남은 수
  const totalDealt = room.users.reduce((sum, u) => sum + (u.cardPack?.length || 0), 0);
  room.gameState.remainingDeck = Math.max(deck.length - totalDealt, 0);

  // 첫 번째 플레이어 설정
  room.gameState.currentTurn = 0;

  console.log(`[Game] 게임 시작 - 방: ${room.name}, 플레이어: ${room.users.length}명`);

  await saveRoomState(room);
  return room;
};

/**
 * 게임 상태 조회
 * @param {string} roomId - 방 ID
 * @returns {Object} 게임 상태
 */
const buildGameState = (room) => {
  if (!room) {
    throw new Error('방을 찾을 수 없습니다.');
  }

  if (!room.gameState) {
    throw new Error('게임이 시작되지 않았습니다.');
  }

  normalizeCurrentTurn(room);

  return {
    roomId: room.id,
    status: room.status,
    phase: room.gameState.phase,
    currentTurn: room.gameState.currentTurn,
    // 중앙 카드는 계속 쌓이는 목록이고 각 더미의 아래 카드는 가려진 카드이므로 장수만 보낸다
    centerCount: (room.gameState.centerCards || []).length,
    // 버림 더미는 뒤집어 놓은 카드 — 내용은 공개하지 않고 장수만
    discardedCount: (room.gameState.discardedCards || []).length,
    remainingDeck: room.gameState.remainingDeck,
    boardSeq: room.gameState.boardSeq || 0,
    players: room.users.map(user => ({
      id: user.id,
      name: user.name,
      cardCount: user.cardPack.length,
      score: user.score,
      isActive: user.isActive
    })),
    gameStartTime: room.gameState.gameStartTime,
    lastActionTime: room.gameState.lastActionTime
  };
};

const getGameState = async (roomId) => buildGameState(await getRoomById(roomId));

/**
 * 카드 내기
 * @param {string} roomId - 방 ID
 * @param {string} playerId - 플레이어 ID
 * @param {number} cardIndex - 내는 카드 인덱스
 * @param {Object} [preloadedRoom] - 호출자가 이미 읽어 둔 방 객체 (있으면 다시 읽지 않는다).
 *   호출자는 방 락을 잡은 상태여야 하며, 이 객체가 변경·저장된다.
 * @returns {Object} 카드 내기 결과
 */
const playCard = async (roomId, playerId, cardIndex, preloadedRoom) => {
  const room = preloadedRoom || await getRoomById(roomId);
  if (!room || !room.gameState) {
    throw new Error('게임이 시작되지 않았습니다.');
  }

  // 끝난 게임(phase 'finished', 방은 waiting)에서 카드를 내면 상태가 다시 바뀌므로 거부한다
  if (room.status !== 'playing' || room.gameState.phase !== 'playing') {
    throw new Error('게임이 진행 중이 아닙니다.');
  }

  normalizeCurrentTurn(room);
  const player = room.users.find(user => user.id === playerId);
  if (!player) {
    throw new Error('플레이어를 찾을 수 없습니다.');
  }

  if (room.gameState.currentTurn !== room.users.findIndex(u => u.id === playerId)) {
    throw new Error('당신의 턴이 아닙니다.');
  }

  if (cardIndex < 0 || cardIndex >= player.cardPack.length) {
    if (!playerHasCards(player)) {
      markPlayerActiveState(player);
      advanceTurn(room);
      await saveRoomState(room, { reindex: false });
      throw new Error('카드가 없어 탈락했습니다.');
    }
    throw new Error('유효하지 않은 카드입니다.');
  }

  // 벨 시간 보정: 이 카드가 깔리기 직전의 바닥을 기억해 둔다 (그 바닥을 보고 누른 벨은 그 바닥으로 판정)
  room.gameState.prevTopCards = topCardsOf(room);
  room.gameState.boardSeq = (room.gameState.boardSeq || 0) + 1;
  room.gameState.lastPlayAt = Date.now();

  // 카드 내기
  const playedCard = player.cardPack.splice(cardIndex, 1)[0];
  room.gameState.centerCards.push(playedCard);
  
  // 플레이어별 스택에도 추가 (맨 위 카드로)
  if (!room.gameState.playerStacks[playerId]) {
    room.gameState.playerStacks[playerId] = [];
  }
  room.gameState.playerStacks[playerId].push(playedCard);

  // 할리갈리 조건 확인 (각 플레이어의 맨 위 카드만 체크)
  const isHalliGalli = checkHalliGalli(topCardsOf(room));

  // 턴 넘기기
  markPlayerActiveState(player);
  advanceTurn(room);
  room.gameState.lastActionTime = new Date().toISOString();

  console.log(`[Game] 카드 내기 - 플레이어: ${player.name}, 카드: ${playedCard.fruit} ${playedCard.count}개`);

  // 게임 중에는 방 이름/상태가 바뀌지 않으므로 색인 갱신 생략
  await saveRoomState(room, { reindex: false });

  return {
    playedCard,
    centerCards: room.gameState.centerCards,
    isHalliGalli,
    nextTurn: room.gameState.currentTurn,
    playerCardCount: player.cardPack.length,
    boardSeq: room.gameState.boardSeq
  };
};

// 벨 클릭 후 처리가 완료될 때까지 동시 요청을 막기 위한 잠금 세트
const halliGalliLocks = new Set();

/**
 * 할리갈리 처리
 * @param {string} roomId - 방 ID
 * @param {string} playerId - 플레이어 ID
 * @param {Object} [preloadedRoom] - 호출자가 이미 읽어 둔 방 객체 (playCard 와 동일한 규칙)
 * @param {{usePrevBoard?: boolean}} [opts] - usePrevBoard: 마지막 카드가 깔리기 직전 바닥으로 판정
 *   (그 바닥을 보고 눌렀는데 네트워크 때문에 새 카드보다 늦게 도착한 벨 — 호출자가 조건을 검사한다)
 * @returns {Object} 할리갈리 처리 결과
 */
const handleHalliGalli = async (roomId, playerId, preloadedRoom, { usePrevBoard = false } = {}) => {
  const room = preloadedRoom || await getRoomById(roomId);
  if (!room || !room.gameState) {
    throw new Error('게임이 시작되지 않았습니다.');
  }

  // 게임 진행 중 상태 검증
  if (room.gameState.phase !== 'playing') {
    throw new Error('게임이 진행 중이 아닙니다.');
  }

  // 방 단위 중복 처리 방지: 이미 처리 중인 halliGalli 요청이 있으면 차단
  if (halliGalliLocks.has(roomId)) {
    throw new Error('이미 처리 중입니다. 잠시 후 다시 시도하세요.');
  }

  // 중앙에 카드가 없으면 의미 없는 벨 클릭
  if (!room.gameState.centerCards || room.gameState.centerCards.length === 0) {
    throw new Error('아직 카드가 없습니다.');
  }

  const player = room.users.find(user => user.id === playerId);
  if (!player) {
    throw new Error('플레이어를 찾을 수 없습니다.');
  }

  // 카드를 모두 잃은 플레이어는 탈락: 벨로 카드를 가져가 다시 살아나지 못한다 (3인 이상에서 게임이 계속되는 동안)
  if (!playerHasCards(player)) {
    throw new Error('카드를 모두 잃어 탈락했습니다.');
  }

  halliGalliLocks.add(roomId);
  try {
  // 할리갈리 조건 확인 (각 플레이어의 맨 위 카드만 체크, 버림 카드 제외)
  const judgedOnPrev = Boolean(usePrevBoard && Array.isArray(room.gameState.prevTopCards));
  const topCards = judgedOnPrev ? room.gameState.prevTopCards : topCardsOf(room);
  const isHalliGalli = checkHalliGalli(topCards);

  // 디버깅: 맨 위 카드 상태 로깅
  const cardSums = calculateCardSum(topCards);
  console.log(`[Game] 할리갈리 체크 - 플레이어: ${player.name}, 맨 위 카드 합계:`, cardSums);

  if (isHalliGalli) {
    // 성공: 중앙 카드 + 버림 카드 모두 가져가기
    const centerCardsCount = room.gameState.centerCards.length;
    const discardedCardsCount = room.gameState.discardedCards.length;
    const totalCardsGained = centerCardsCount + discardedCardsCount;

    // 획득한 모든 카드를 합치기
    const gainedCards = [...room.gameState.centerCards, ...room.gameState.discardedCards];

    // 카드 섞기
    const shuffledGainedCards = shuffleCards(gainedCards);

    // 플레이어의 덱 맨 아래에 추가 (배열 끝에 추가)
    player.cardPack.push(...shuffledGainedCards);

    player.score += totalCardsGained;
    room.gameState.centerCards = [];
    room.gameState.discardedCards = [];

    // 각 플레이어의 스택도 초기화 (바닥이 비워졌으므로 새 바닥 번호)
    Object.keys(room.gameState.playerStacks).forEach(pid => {
      room.gameState.playerStacks[pid] = [];
    });
    room.gameState.boardSeq = (room.gameState.boardSeq || 0) + 1;
    room.gameState.prevTopCards = null;

    console.log(`[Game] 할리갈리 성공! - 플레이어: ${player.name}, 획득: 중앙 ${centerCardsCount}장 + 버림 ${discardedCardsCount}장 = 총 ${totalCardsGained}점, 현재 덱: ${player.cardPack.length}장`);

    markPlayerActiveState(player);
    await saveRoomState(room, { reindex: false });

    return {
      success: true,
      playerName: player.name,
      scoreGained: totalCardsGained,
      centerCardsGained: centerCardsCount,
      discardedCardsGained: discardedCardsCount,
      newScore: player.score,
      playerCardCount: player.cardPack.length,
      judgedOnPrev,
      boardSeq: room.gameState.boardSeq,
      centerCards: [],
      discardedCards: []
    };
  } else {
    // 실패: 덱 맨 아래 카드 1장 버리기 (버림 카드 덱으로). 마지막 1장이면 이걸로 탈락한다
    const discardedCard = player.cardPack.pop(); // 배열의 마지막 요소(맨 아래 카드) 제거
    room.gameState.discardedCards.push(discardedCard);

    console.log(`[Game] 할리갈리 실패 - 플레이어: ${player.name}, 카드 버림: ${discardedCard.fruit} ${discardedCard.count}개`);

    markPlayerActiveState(player);
    normalizeCurrentTurn(room);
    await saveRoomState(room, { reindex: false });

    return {
      success: false,
      playerName: player.name,
      discardedCard,
      judgedOnPrev,
      boardSeq: room.gameState.boardSeq,
      centerCards: room.gameState.centerCards,
      discardedCards: room.gameState.discardedCards
    };
  }
  } finally {
    halliGalliLocks.delete(roomId);
  }
};

/**
 * 게임 종료 확인
 * @param {string} roomId - 방 ID
 * @param {Object} [preloadedRoom] - 호출자가 이미 읽어 둔 방 객체 (playCard 와 동일한 규칙)
 * @returns {Object} 게임 종료 정보
 */
const checkGameEnd = async (roomId, preloadedRoom) => {
  const room = preloadedRoom || await getRoomById(roomId);
  if (!room || !room.gameState) {
    return { isEnded: false };
  }

  // 카드가 없는 플레이어가 있으면 게임 종료
  const playersWithCards = room.users.filter(user => user.cardPack.length > 0);
  
  if (playersWithCards.length <= 1) {
    room.gameState.phase = 'finished';
    room.status = 'waiting';
    
    // 승자 결정 (카드를 가장 많이 가진 플레이어)
    const winner = room.users.reduce((prev, current) => 
      (prev.cardPack.length > current.cardPack.length) ? prev : current
    );
    
    // 모든 플레이어 상태를 대기중으로 변경
    room.users.forEach(user => {
      user.readyStatus = 'waiting';
    });
    
    console.log(`[Game] 게임 종료 - 승자: ${winner.name}, 카드 수: ${winner.cardPack.length}장, 점수: ${winner.score}`);

    await saveRoomState(room);

    return {
      isEnded: true,
      winner: {
        id: winner.id,
        name: winner.name,
        score: winner.score,
        cardCount: winner.cardPack.length
      },
      finalScores: room.users.map(user => ({
        id: user.id,
        name: user.name,
        score: user.score,
        cardCount: user.cardPack.length
      }))
    };
  }

  return { isEnded: false };
};

/**
 * 게임 리셋
 * @param {string} roomId - 방 ID
 */
const resetGame = async (roomId) => {
  const room = await getRoomById(roomId);
  if (!room) {
    throw new Error('방을 찾을 수 없습니다.');
  }

  // 게임 상태 초기화
  room.status = 'waiting';
  room.gameState = null;
  
  // 플레이어 상태 초기화
  room.users.forEach(user => {
    user.cardPack = [];
    user.score = 0;
    user.isActive = false;
    user.readyStatus = 'waiting';
  });

  console.log(`[Game] 게임 리셋 - 방: ${room.name}`);
  await saveRoomState(room);
};

module.exports = { 
  startGame, 
  getGameState, 
  buildGameState, 
  playCard, 
  handleHalliGalli, 
  checkGameEnd, 
  resetGame 
};
