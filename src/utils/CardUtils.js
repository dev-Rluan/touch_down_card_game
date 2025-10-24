const Card = require('../models/Card');

/**
 * 할리갈리 카드 덱 생성
 * @returns {Array} 카드 배열
 */
const createDeck = () => {
  const fruits = ['strawberry', 'banana', 'plum', 'lemon'];
  const counts = [
    { count: 1, num: 5 },
    { count: 2, num: 3 },
    { count: 3, num: 3 },
    { count: 4, num: 2 },
    { count: 5, num: 1 },
  ];
  const deck = [];

  for (const fruit of fruits) {
    for (const item of counts) {
      for (let i = 0; i < item.num; i++) {
        deck.push(new Card(fruit, item.count));
      }
    }
  }
  
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
  const dealtCards = {};
  players.forEach(player => {
    dealtCards[player.id] = [];
  });

  let playerIndex = 0;
  deck.forEach(card => {
    dealtCards[players[playerIndex].id].push(card);
    playerIndex = (playerIndex + 1) % players.length;
  });

  return dealtCards;
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
