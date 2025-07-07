// /services/gameService.js
// Room, Game 등의 모델을 직접 import할 수도 있고,
// 이미 roomService에서 관리하는 rooms 배열에 접근하기도 합니다.

const roomService = require("./roomService");
const Game = require("../models/Game");

async function userReady(socketId, roomId) {
  console.log(`[userReady] called with socketId=${socketId}, roomId=${roomId}`);
  const room = roomService.findRoom(roomId);
  if (!room) {
    console.log(`[userReady] 방을 찾을 수 없습니다. roomId=${roomId}`);
    throw new Error("방을 찾을 수 없습니다.");
  }
  if (room.status !== "waiting") {
    console.log(`[userReady] 이미 게임이 시작된 방입니다. roomId=${roomId}`);
    throw new Error("이미 게임이 시작된 방입니다.");
  }

  // 해당 유저 찾기
  const user = room.users.find((u) => u.socketId === socketId || u.id === socketId);
  if (!user) {
    console.log(`[userReady] 방에 속해 있지 않은 유저입니다. socketId=${socketId}`);
    throw new Error("방에 속해 있지 않은 유저입니다.");
  }

  // 레디 상태 설정
  user.readyStatus = true;
  console.log(`[userReady] user readyStatus set:`, user);
  console.log(`[userReady] room.users:`, room.users);
  return room;
}

/**
 * 모든 유저가 레디인지 확인
 * @param {Room} room
 * @returns {boolean}
 */
function checkAllReady(room) {
  return room.users.every((u) => u.readyStatus === true);
}

/**
 * 게임 시작
 * @param {string} roomId
 */
async function startGame(roomId) {
  const room = roomService.findRoom(roomId);
  if (!room) {
    throw new Error("방을 찾을 수 없습니다.");
  }
  if (room.users.length < 1) {
    throw new Error("방에 유저가 없습니다.");
  }
  // 상태 변경
  room.setStatus("playing");

  // Room 내에 game 객체가 없으면 생성
  if (!room.game) {
    const rules = {}; // 필요 시 room 생성 시 넣어둔 rule
    room.initGame(rules);
  }

  // Game 시작 로직
  room.game.start(room.users);

  // 게임 정보 반환
  return {
    roomId: room.id,
    users: room.users.map((u) => ({
      id: u.id,
      name: u.name,
      cardCount: u.cardPack.length,
    })),
    // 필드 상태, turnIndex, 등등
    turnIndex: room.game.turnIndex,
    status: room.game.status,
  };
}

/**
 * 턴 진행(카드 뒤집기 등)
 * @param {string} socketId
 * @param {string} roomId
 */
async function playTurn(socketId, roomId) {
  const room = roomService.findRoom(roomId);
  if (!room) {
    throw new Error("방이 존재하지 않습니다.");
  }
  if (!room.game || room.game.status !== "playing") {
    throw new Error("게임이 진행중이 아닙니다.");
  }

  // 누가 턴을 진행하는지 확인
  const userIndex = room.users.findIndex((u) => u.socketId === socketId);
  if (userIndex < 0) {
    throw new Error("방에 속해 있지 않은 유저입니다.");
  }
  
  // 현재 턴인지 확인(혹은 턴 순서 무시 시 해당 체크는 생략)
  if (room.game.turnIndex !== userIndex) {
    throw new Error("현재 턴이 아닙니다.");
  }

  // 실제 "카드 뒤집기" 로직 (필요 시 room.game 내 메서드 호출)
  // 예: card = users[userIndex].removeCard(0); // 맨 위 카드 뒤집기
  // room.game.fieldCards.push(card);

  // 턴 이동
  room.game.nextTurn(room.users);

  return {
    fieldCards: room.game.fieldCards,
    turnIndex: room.game.turnIndex,
    // 기타 필요한 게임 상태
  };
}

/**
 * 종 치기 (ringBell)
 * @param {string} socketId
 * @param {string} roomId
 */
async function ringBell(socketId, roomId) {
  const room = roomService.findRoom(roomId);
  if (!room) {
    throw new Error("방이 존재하지 않습니다.");
  }
  if (!room.game || room.game.status !== "playing") {
    throw new Error("게임이 진행중이 아닙니다.");
  }

  const user = room.users.find((u) => u.socketId === socketId);
  if (!user) {
    throw new Error("해당 유저를 찾을 수 없습니다.");
  }

  // Game 객체에 종 치기 로직을 위임
  // ex: room.game.handleBell(user)
  room.game.handleBell(user);

  // handleBell 함수가 return 값으로 성공/실패 여부 등을 준다고 가정
  // 예: { success: true, gainedCards: [...], reason: "조건 충족" }
  return {
    success: true,
    message: "벨 누르기 성공! 카드 획득!",
    userId: user.id,
    // ...
  };
}

/**
 * 게임 종료
 * @param {string} roomId
 */
async function endGame(roomId) {
  const room = roomService.findRoom(roomId);
  if (!room) {
    throw new Error("방을 찾을 수 없습니다.");
  }
  if (!room.game) {
    throw new Error("게임이 진행 중이 아닙니다.");
  }

  room.endGame(); // Room에서 this.game.end() + status = 'finished'
  
  // 승자 계산 로직 (간단히 남은 카드가 제일 많은 유저 등)
  const winner = room.users.reduce((prev, current) => {
    return (prev.cardPack.length > current.cardPack.length) ? prev : current;
  });

  return {
    roomId: room.id,
    winner: { id: winner.id, name: winner.name },
    users: room.users.map((u) => ({
      id: u.id,
      name: u.name,
      cardCount: u.cardPack.length,
      score: u.score,
    })),
  };
}

module.exports = {
  userReady,
  checkAllReady,
  startGame,
  playTurn,
  ringBell,
  endGame
};