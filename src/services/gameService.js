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
    centerCards: [],
    remainingDeck: [],
    gameStartTime: new Date().toISOString(),
    lastActionTime: new Date().toISOString()
  };

  // 카드 덱 생성 및 분배
  const deck = shuffleCards(createDeck());
  const dealResult = dealCards(room.users, deck);

  // 각 플레이어에게 카드 분배
  room.users.forEach((user, index) => {
    const playerCards = dealResult.playerCards[index];
    user.cardPack = playerCards.cards;
    user.score = 0;
    user.isActive = true;
  });

  // 중앙 카드 설정
  room.gameState.centerCards = dealResult.centerCards;
  room.gameState.remainingDeck = dealResult.remainingDeck;

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

  // 할리갈리 조건 확인
  const isHalliGalli = checkHalliGalli(room.gameState.centerCards);
  
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

  // 할리갈리 조건 확인
  const isHalliGalli = checkHalliGalli(room.gameState.centerCards);
  
  if (isHalliGalli) {
    // 성공: 중앙 카드 모두 가져가기
    player.score += room.gameState.centerCards.length;
    room.gameState.centerCards = [];
    
    console.log(`[Game] 할리갈리 성공! - 플레이어: ${player.name}, 점수: +${room.gameState.centerCards.length}`);
    
    return {
      success: true,
      playerName: player.name,
      scoreGained: room.gameState.centerCards.length,
      newScore: player.score,
      centerCards: []
    };
  } else {
    // 실패: 카드 1장 버리기
    if (player.cardPack.length > 0) {
      const discardedCard = player.cardPack.pop();
      room.gameState.centerCards.push(discardedCard);
      
      console.log(`[Game] 할리갈리 실패 - 플레이어: ${player.name}, 카드 버림: ${discardedCard.fruit} ${discardedCard.count}개`);
      
      return {
        success: false,
        playerName: player.name,
        discardedCard,
        centerCards: room.gameState.centerCards
      };
    }
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
    
    // 승자 결정
    const winner = room.users.reduce((prev, current) => 
      (prev.score > current.score) ? prev : current
    );
    
    console.log(`[Game] 게임 종료 - 승자: ${winner.name}, 점수: ${winner.score}`);
    
    return {
      isEnded: true,
      winner: {
        id: winner.id,
        name: winner.name,
        score: winner.score
      },
      finalScores: room.users.map(user => ({
        id: user.id,
        name: user.name,
        score: user.score
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
