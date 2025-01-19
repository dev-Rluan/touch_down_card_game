// /models/User.js

class User {
  /**
   * @param {string} id        - 내부적으로 식별할 유저 고유 ID(백엔드용)
   * @param {string} socketId  - socket.io에서 할당된 소켓 ID
   * @param {string} name      - 유저 닉네임
   */
  constructor(id, socketId, name) {
    this.id = id;
    this.socketId = socketId;
    this.name = name;
    
    // 게임 관련 상태
    this.score = 0;
    this.readyStatus = false;   // 'waiting', 'ready', ...
    this.manager = false;       // 방장 여부
    this.cardPack = [];         // 이 유저가 가지고 있는 카드들 (array of Card)

    // 기타 필요 속성
    // this.avatar = "";
    // this.profileImage = "";
    // this.inGame = false;
    // ...
  }

  // 유저가 레디 상태인지 설정
  setReadyStatus(isReady) {
    this.readyStatus = isReady;
  }

  // 점수 업데이트
  updateScore(amount) {
    this.score += amount;
  }

  // 카드 추가
  addCard(card) {
    this.cardPack.push(card);
  }

  // 카드 여러장 한 번에 추가
  addCards(cards) {
    this.cardPack.push(...cards);
  }

  // 카드 제거 (예: 필드에 낼 때, 뺏길 때 등)
  removeCard(index) {
    if (index < 0 || index >= this.cardPack.length) return null;
    return this.cardPack.splice(index, 1)[0];
  }
}

module.exports = User;