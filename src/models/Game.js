// /models/Game.js

const Card = require('./Card');

class Game {
  /**
   * @param {string} roomId  - 어떤 방에서 진행되는 게임인지 식별
   * @param {object} rules   - 룰 설정 { totalCards, cardTypes, bellCondition, timeLimit, turnLimit, ... }
   */
  constructor(roomId, rules = {}) {
    this.roomId = roomId;
    this.rules = rules;
    
    // 게임 상태
    this.deck = [];            // 전체 카드 덱
    this.turnIndex = 0;        // 현재 턴 유저 인덱스
    this.status = 'not_started'; // 'not_started', 'playing', 'ended', ...
    this.fieldCards = [];      // 예: 필드에 펼쳐진 카드들

    // 추가로 필요한 상태
    // this.players = [];       // User 목록 (room.users 참조 가능)
    // ...
  }

  // 게임 시작 로직
  start(users) {
    this.status = 'playing';
    
    // 1) 전체 카드 덱 생성
    this.createDeck();
    // 2) 셔플
    this.shuffleDeck();
    // 3) 유저들에게 카드 분배
    this.distributeCards(users);
    
    // ...
  }

  createDeck() {
    const fruits = ['strawberry', 'banana', 'plum', 'lemon'];
    const counts = [
      { count: 1, num: 5 },
      { count: 2, num: 3 },
      { count: 3, num: 3 },
      { count: 4, num: 2 },
      { count: 5, num: 1 },
    ];

    this.deck = [];
    for (const fruit of fruits) {
      for (const item of counts) {
        for (let i = 0; i < item.num; i++) {
          this.deck.push(new Card(fruit, item.count));
        }
      }
    }
  }

  // 카드 덱 셔플
  shuffleDeck() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const randIndex = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[randIndex]] = [this.deck[randIndex], this.deck[i]];
    }
  }

  // 카드 분배
  distributeCards(users) {
    // 모든 유저가 균등하게 나누어가진다 (잔여는 무시 or 랜덤)
    const userCount = users.length;
    let idx = 0;
    while (this.deck.length > 0) {
      const card = this.deck.pop();
      users[idx].cardPack.push(card);
      idx = (idx + 1) % userCount;
    }
  }

  // 턴 이동
  nextTurn(users) {
    // 현재 턴 인덱스를 다음으로
    this.turnIndex = (this.turnIndex + 1) % users.length;
  }

  // 종 치기 처리
  handleBell(user) {
    // 1) 필드의 카드 상태 검사
    // 2) 조건(bellCondition)에 따라 성공/실패 판정
    // 3) 성공 시 user가 필드 카드 획득 -> user.addCards(this.fieldCards)
    // 4) 필드 카드 비우기
    // ...
  }

  // 게임 종료
  end() {
    this.status = 'ended';
    // 승자 판정 등
  }
}

module.exports = Game;