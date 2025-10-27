const { getRoomById, updateRoomStatus } = require('./roomService');
const { createDeck, shuffleCards, dealCards, checkHalliGalli, calculateCardSum } = require('../utils/CardUtils');

/**
 * 게임 시작
 * @param {string} roomId - 방 ID
 * @returns {Object} 게임 시작 정보
 */
const startGame = (roomId) => {
  const room = getRoomById(roomId);
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
  
  return room;
};

/**
 * 게임 상태 조회
 * @param {string} roomId - 방 ID
 * @returns {Object} 게임 상태
 */
const getGameState = (roomId) => {
  const room = getRoomById(roomId);
  if (!room) {
    throw new Error('방을 찾을 수 없습니다.');
  }

  if (!room.gameState) {
    throw new Error('게임이 시작되지 않았습니다.');
  }

  return {
    roomId: room.id,
    status: room.status,
    phase: room.gameState.phase,
    currentTurn: room.gameState.currentTurn,
    centerCards: room.gameState.centerCards,
    discardedCards: room.gameState.discardedCards || [],
    remainingDeck: room.gameState.remainingDeck,
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

/**
 * 카드 내기
 * @param {string} roomId - 방 ID
 * @param {string} playerId - 플레이어 ID
 * @param {number} cardIndex - 내는 카드 인덱스
 * @returns {Object} 카드 내기 결과
 */
const playCard = (roomId, playerId, cardIndex) => {
  const room = getRoomById(roomId);
  if (!room || !room.gameState) {
    throw new Error('게임이 시작되지 않았습니다.');
  }

  const player = room.users.find(user => user.id === playerId);
  if (!player) {
    throw new Error('플레이어를 찾을 수 없습니다.');
  }

  if (room.gameState.currentTurn !== room.users.findIndex(u => u.id === playerId)) {
    throw new Error('당신의 턴이 아닙니다.');
  }

  if (cardIndex < 0 || cardIndex >= player.cardPack.length) {
    throw new Error('유효하지 않은 카드입니다.');
  }

  // 카드 내기
  const playedCard = player.cardPack.splice(cardIndex, 1)[0];
  room.gameState.centerCards.push(playedCard);
  
  // 플레이어별 스택에도 추가 (맨 위 카드로)
  if (!room.gameState.playerStacks[playerId]) {
    room.gameState.playerStacks[playerId] = [];
  }
  room.gameState.playerStacks[playerId].push(playedCard);

  // 할리갈리 조건 확인 (각 플레이어의 맨 위 카드만 체크)
  const topCards = Object.values(room.gameState.playerStacks)
    .filter(stack => stack.length > 0)
    .map(stack => stack[stack.length - 1]); // 각 스택의 맨 위 카드
  const isHalliGalli = checkHalliGalli(topCards);
  
  // 턴 넘기기
  room.gameState.currentTurn = (room.gameState.currentTurn + 1) % room.users.length;
  room.gameState.lastActionTime = new Date().toISOString();

  console.log(`[Game] 카드 내기 - 플레이어: ${player.name}, 카드: ${playedCard.fruit} ${playedCard.count}개`);

  return {
    playedCard,
    centerCards: room.gameState.centerCards,
    isHalliGalli,
    nextTurn: room.gameState.currentTurn,
    playerCardCount: player.cardPack.length
  };
};

/**
 * 할리갈리 처리
 * @param {string} roomId - 방 ID
 * @param {string} playerId - 플레이어 ID
 * @returns {Object} 할리갈리 처리 결과
 */
const handleHalliGalli = (roomId, playerId) => {
  const room = getRoomById(roomId);
  if (!room || !room.gameState) {
    throw new Error('게임이 시작되지 않았습니다.');
  }

  const player = room.users.find(user => user.id === playerId);
  if (!player) {
    throw new Error('플레이어를 찾을 수 없습니다.');
  }

  // 할리갈리 조건 확인 (각 플레이어의 맨 위 카드만 체크, 버림 카드 제외)
  const topCards = Object.values(room.gameState.playerStacks)
    .filter(stack => stack.length > 0)
    .map(stack => stack[stack.length - 1]); // 각 스택의 맨 위 카드
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
    
    // 각 플레이어의 스택도 초기화
    Object.keys(room.gameState.playerStacks).forEach(pid => {
      room.gameState.playerStacks[pid] = [];
    });
    
    console.log(`[Game] 할리갈리 성공! - 플레이어: ${player.name}, 획득: 중앙 ${centerCardsCount}장 + 버림 ${discardedCardsCount}장 = 총 ${totalCardsGained}점, 현재 덱: ${player.cardPack.length}장`);
    
    return {
      success: true,
      playerName: player.name,
      scoreGained: totalCardsGained,
      centerCardsGained: centerCardsCount,
      discardedCardsGained: discardedCardsCount,
      newScore: player.score,
      playerCardCount: player.cardPack.length,
      centerCards: [],
      discardedCards: []
    };
  } else {
    // 실패: 덱 맨 아래 카드 1장 버리기 (버림 카드 덱으로)
    if (player.cardPack.length > 0) {
      const discardedCard = player.cardPack.pop(); // 배열의 마지막 요소(맨 아래 카드) 제거
      room.gameState.discardedCards.push(discardedCard);
      
      console.log(`[Game] 할리갈리 실패 - 플레이어: ${player.name}, 카드 버림: ${discardedCard.fruit} ${discardedCard.count}개`);
      
      return {
        success: false,
        playerName: player.name,
        discardedCard,
        centerCards: room.gameState.centerCards,
        discardedCards: room.gameState.discardedCards
      };
    }
    
    // 카드가 없을 경우에도 실패 응답
    return {
      success: false,
      playerName: player.name,
      centerCards: room.gameState.centerCards,
      discardedCards: room.gameState.discardedCards
    };
  }
};

/**
 * 게임 종료 확인
 * @param {string} roomId - 방 ID
 * @returns {Object} 게임 종료 정보
 */
const checkGameEnd = (roomId) => {
  const room = getRoomById(roomId);
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
const resetGame = (roomId) => {
  const room = getRoomById(roomId);
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
};

module.exports = { 
  startGame, 
  getGameState, 
  playCard, 
  handleHalliGalli, 
  checkGameEnd, 
  resetGame 
};
