/**
 * 게임 시작 카운트다운 관리 유틸리티
 */

const gameService = require('../services/gameService');
const roomService = require('../services/roomService');
const userServices = require('../services/userServices');

// 방별 게임 시작 카운트다운 타이머 관리
const gameStartTimers = new Map(); // roomId -> { intervalId, timeoutId, secondsLeft }

/**
 * 방의 게임 시작 카운트다운을 취소하고 알림을 전송합니다.
 * @param {Server} io - Socket.IO Server Instance
 * @param {string} roomId - 방 ID
 * @param {string} reason - 취소 사유
 */
function clearGameCountdown(io, roomId, reason = 'canceled') {
  const timers = gameStartTimers.get(roomId);
  if (timers) {
    if (timers.intervalId) clearInterval(timers.intervalId);
    if (timers.timeoutId) clearTimeout(timers.timeoutId);
    gameStartTimers.delete(roomId);
    io.to(roomId).emit('gameCountdownCanceled', { reason });
  }
}

/**
 * 모든 유저가 ready 상태이고 2명 이상인지 재검증합니다.
 * @param {Object} room - 방 정보
 * @returns {boolean}
 */
function canStartGame(room) {
  if (!room) return false;
  if (!Array.isArray(room.users) || room.users.length < 2) return false;
  return room.users.every(u => u.readyStatus === 'ready');
}

/**
 * 방에 대한 게임 시작 카운트다운을 시작합니다.
 * @param {Server} io - Socket.IO Server Instance
 * @param {string} roomId - 방 ID
 */
function startGameCountdown(io, roomId) {
  // 중복 실행 방지: 기존 타이머 제거
  clearGameCountdown(io, roomId, 'restarting');

  const room = roomService.getRoomById(roomId);
  if (!canStartGame(room)) return; // 조건 불충족 시 무시

  const totalSeconds = 3;
  let secondsLeft = totalSeconds;
  io.to(roomId).emit('gameCountdownStart', { total: totalSeconds });

  const intervalId = setInterval(() => {
    secondsLeft -= 1;
    if (secondsLeft > 0) {
      io.to(roomId).emit('gameCountdown', { secondsLeft });
    }
  }, 1000);

  const timeoutId = setTimeout(() => {
    // 종료 시점 재검증
    const latestRoom = roomService.getRoomById(roomId);
    if (!canStartGame(latestRoom)) {
      clearGameCountdown(io, roomId, 'condition-changed');
      return;
    }

    // 타이머 정리 후 게임 시작
    clearGameCountdown(io, roomId, 'completed');
    try {
      const gameStartData = gameService.startGame(roomId);
      // 공개 정보만 브로드캐스트
      const publicData = {
        roomId: gameStartData.id,
        status: gameStartData.status,
        players: gameStartData.users.map(u => ({
          id: u.id,
          name: u.name,
          cardCount: Array.isArray(u.cardPack) ? u.cardPack.length : 0,
          readyStatus: u.readyStatus,
          manager: u.manager
        })),
        currentTurn: gameStartData.gameState?.currentTurn ?? 0,
        centerCards: gameStartData.gameState?.centerCards?.length ?? 0
      };
      io.to(roomId).emit('gameStart', {
        message: '게임이 시작됩니다!',
        gameData: publicData
      });

      // 각 플레이어에게 자신의 핸드 개별 전송
      const latestRoom = roomService.getRoomById(roomId);
      if (latestRoom && Array.isArray(latestRoom.users)) {
        latestRoom.users.forEach(u => {
          try {
            io.to(u.id).emit('yourHand', { cards: u.cardPack || [] });
          } catch (e) {
            console.error('[yourHand emit Error]', e);
          }
        });
      }

      setTimeout(() => {
        try {
          const gameState = gameService.getGameState(roomId);
          io.to(roomId).emit('gameState', gameState);
        } catch (err) {
          console.error('[gameState emit after start Error]', err);
        }
      }, 100);
    } catch (error) {
      console.error('[Game Start Error]', error);
      io.to(roomId).emit('gameStartError', error.message);
    }
  }, totalSeconds * 1000);

  gameStartTimers.set(roomId, { intervalId, timeoutId, secondsLeft });
  // 즉시 최초 카운트다운 표시
  io.to(roomId).emit('gameCountdown', { secondsLeft });
}

module.exports = {
  clearGameCountdown,
  startGameCountdown,
  canStartGame
};

