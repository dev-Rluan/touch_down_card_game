// /controllers/gameController.js

const gameService = require("../services/gameService");

/**
 * 유저가 레디를 누름
 * @param {Socket} socket
 * @param {object} data - { roomId }
 */
async function ready(socket, data) {
  try {
    const updatedRoom = await gameService.userReady(socket.id, data.roomId);
    
    // 같은 방 유저들에게 현재 레디 현황 알리기
    socket.to(data.roomId).emit("readyStatusChanged", updatedRoom.users);

    // 만약 모든 유저가 레디라면 게임 시작 로직 호출, 또는 방장(매니저)가 start를 누를 때까지 대기
    if (gameService.checkAllReady(updatedRoom)) {
      // 자동으로 startGame을 호출할 수도 있음
      // await startGame(socket, { roomId: data.roomId });
    }

  } catch (error) {
    console.error("[ready Error]", error);
    socket.emit("readyError", error.message);
  }
}

/**
 * 게임 시작
 * @param {Socket} socket
 * @param {object} data - { roomId }
 */
async function startGame(socket, data) {
  try {
    const gameInfo = await gameService.startGame(data.roomId);
    
    // 방 상태를 playing으로 바꾸고, 각 유저 카드 분배 등 처리
    socket.to(data.roomId).emit("gameStarted", gameInfo);
    socket.emit("gameStarted", gameInfo);

  } catch (error) {
    console.error("[startGame Error]", error);
    socket.emit("startGameError", error.message);
  }
}

/**
 * 턴 진행(카드 뒤집기 등)
 * @param {Socket} socket
 * @param {object} data - { roomId }
 */
async function playTurn(socket, data) {
  try {
    const turnResult = await gameService.playTurn(socket.id, data.roomId);
    // turnResult 안에 필드 상황, 다음 턴 유저, 카드 상태 등 정보가 있을 것

    // 해당 방의 모든 유저에게 현재 필드 상태/턴 정보를 전송
    socket.to(data.roomId).emit("turnPlayed", turnResult);
    socket.emit("turnPlayed", turnResult);

  } catch (error) {
    console.error("[playTurn Error]", error);
    socket.emit("playTurnError", error.message);
  }
}

/**
 * 종 치기 이벤트
 * @param {Socket} socket
 * @param {object} data - { roomId }
 */
async function bell(socket, data) {
  try {
    const bellResult = await gameService.ringBell(socket.id, data.roomId);

    // bellResult: { success: true/false, updatedUser: {...}, fieldCardsCleared: boolean, ... }
    socket.to(data.roomId).emit("bellResult", bellResult);
    socket.emit("bellResult", bellResult);

  } catch (error) {
    console.error("[bell Error]", error);
    socket.emit("bellError", error.message);
  }
}

/**
 * 게임 종료
 * @param {Socket} socket
 * @param {object} data - { roomId }
 */
async function endGame(socket, data) {
  try {
    const endResult = await gameService.endGame(data.roomId);
    
    // 결과(승자, 점수, 기타 정보) 전송
    socket.to(data.roomId).emit("gameEnded", endResult);
    socket.emit("gameEnded", endResult);

  } catch (error) {
    console.error("[endGame Error]", error);
    socket.emit("endGameError", error.message);
  }
}

module.exports = {
  ready,
  startGame,
  playTurn,
  bell,
  endGame
};