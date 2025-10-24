// /models/Room.js

class Room {
  /**
   * @param {string} id             - 방 고유 ID (UUID 등)
   * @param {string} name           - 방 이름
   * @param {number} maxUserCount   - 최대 인원수
   */
  constructor(id, name, maxUserCount) {
    this.id = id;
    this.name = name;
    this.maxUserCount = maxUserCount;

    // 상태 관리
    this.users = [];    // 현재 방에 있는 User 객체 목록
    this.status = 'waiting'; // 'waiting', 'playing', 'finished' 등
    this.game = null;   // 게임 정보 객체 (Game.js) - 게임 진행 중이라면 할당
  }

  // 유저 추가
  addUser(user) {
    if (this.users.length >= this.maxUserCount) {
      throw new Error(`Room is full: max = ${this.maxUserCount}`);
    }
    this.users.push(user);
  }

  // 유저 제거
  removeUser(userId) {
    this.users = this.users.filter(u => u.id !== userId);
  }

  // 유저 조회
  findUser(userId) {
    return this.users.find(u => u.id === userId);
  }

  // 방장이 현재 없고, 유저가 1명 이상이라면 방장 재설정(예시)
  assignManagerIfNone() {
    const hasManager = this.users.some(u => u.manager);
    if (!hasManager && this.users.length > 0) {
      this.users[0].manager = true;
    }
  }

  // 방 상태 업데이트 (예: 대기->게임중)
  setStatus(status) {
    this.status = status;
  }

  // 게임 초기화 (Game 객체 생성)
  initGame(rules) {
    // Room이 게임 인스턴스를 관리하도록 할 수도 있고,
    // 외부에서 Game.createGame(...) 호출 후 room.game = (만들어진 Game)
    // 형태로 할 수도 있습니다.
    const Game = require('./Game');
    this.game = new Game(this.id, rules);
  }

  // 게임 종료 처리
  endGame() {
    if (this.game) {
      this.game.end();
      this.game = null;
    }
    this.status = 'finished';
  }
}

module.exports = Room;