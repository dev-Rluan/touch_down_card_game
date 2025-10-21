const Card = require('../models/Card');

/**
 * 할리갈리 카드 덱 생성
 * @returns {Array} 카드 배열
 */
const createDeck = () => {
  const fruits = ['strawberry', 'banana', 'plum', 'lemon'];
  const counts = [1, 2, 3, 4, 5];
  const deck = [];
  
  // 각 과일별로 1~5개까지의 카드 생성 (총 20장)
  fruits.forEach(fruit => {
    counts.forEach(count => {
      deck.push(new Card(fruit, count));
    });
  });
  
  return deck;
};

/**
 * 카드 섞기
 * @param {Array} cards - 섞을 카드 배열
 * @returns {Array} 섞인 카드 배열
 */
const shuffleCards = (cards = null) => {
  const deck = cards || createDeck();
  return deck.sort(() => Math.random() - 0.5);
};

/**
 * 카드 분배
 * @param {Array} players - 플레이어 배열
 * @param {Array} deck - 카드 덱
 * @returns {Object} 분배 결과
 */
const dealCards = (players, deck) => {
  const playerCount = players.length;
  const cardsPerPlayer = Math.floor(deck.length / playerCount);
  const remainingCards = deck.length % playerCount;
  
  const result = {
    playerCards: [],
    centerCards: [],
    remainingDeck: []
  };
  
  let cardIndex = 0;
  
  // 각 플레이어에게 카드 분배
  players.forEach((player, index) => {
    const playerCardCount = cardsPerPlayer + (index < remainingCards ? 1 : 0);
    const playerCards = deck.slice(cardIndex, cardIndex + playerCardCount);
    
    result.playerCards.push({
      playerId: player.id,
      playerName: player.name,
      cards: playerCards
    });
    
    cardIndex += playerCardCount;
  });
  
  // 중앙에 카드 배치 (게임 시작용)
  result.centerCards = deck.slice(cardIndex, cardIndex + 4);
  result.remainingDeck = deck.slice(cardIndex + 4);
  
  return result;
};

/**
 * 카드 합계 계산 (할리갈리 규칙)
 * @param {Array} cards - 카드 배열
 * @returns {Object} 과일별 합계
 */
const calculateCardSum = (cards) => {
  const sums = {};
  
  cards.forEach(card => {
    if (!sums[card.fruit]) {
      sums[card.fruit] = 0;
    }
    sums[card.fruit] += card.count;
  });
  
  return sums;
};

/**
 * 할리갈리 조건 확인 (같은 과일이 5개)
 * @param {Array} cards - 확인할 카드 배열
 * @returns {boolean} 할리갈리 조건 만족 여부
 */
const checkHalliGalli = (cards) => {
  const sums = calculateCardSum(cards);
  return Object.values(sums).some(sum => sum === 5);
};

/**
 * 카드 ID 생성
 * @param {string} fruit - 과일 종류
 * @param {number} count - 개수
 * @returns {string} 카드 ID
 */
const generateCardId = (fruit, count) => {
  return `${fruit}_${count}`;
};

/**
 * 카드 정보 가져오기
 * @param {string} cardId - 카드 ID
 * @returns {Object} 카드 정보
 */
const getCardInfo = (cardId) => {
  const [fruit, count] = cardId.split('_');
  return {
    fruit,
    count: parseInt(count),
    id: cardId
  };
};

module.exports = { 
  createDeck,
  shuffleCards, 
  calculateCardSum, 
  dealCards,
  checkHalliGalli,
  generateCardId,
  getCardInfo
};
