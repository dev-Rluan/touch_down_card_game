/**
 * 게임 상태 동기화용 공용 emit 헬퍼
 * gameEvents / roomEvents / userEvents 에서 공통으로 사용한다.
 */
const gameService = require('../services/gameService');
const { toPublicUser } = require('../utils/roomSerializer');
const { scheduleLobbyBroadcast } = require('./lobbyBroadcast');

/** 특정 플레이어에게만 손패 전송 */
function emitHand(io, user) {
  if (!user) return;
  io.to(user.id).emit('yourHand', { cards: user.cardPack || [] });
}

/** 방 전체에 공개 게임 상태 전송 */
function emitGameState(io, room) {
  if (!room || !room.gameState) return;
  io.to(room.id).emit('gameState', gameService.buildGameState(room));
}

/**
 * 종료 조건을 확인하고, 끝났으면 종료/대기실 상태를 방 전체와 로비에 알린다.
 * @returns {Promise<Object|null>} 종료 결과 (진행 중이면 null)
 */
async function finishGameIfEnded(io, room) {
  if (!room) return null;
  const gameEndResult = await gameService.checkGameEnd(room.id, room);
  if (!gameEndResult.isEnded) return null;

  io.to(room.id).emit('gameEnd', gameEndResult);
  // 서버에서 readyStatus가 'waiting'으로 초기화됐으므로 대기실 화면도 동기화
  io.to(room.id).emit('updateReadyStatus', room.users.map(toPublicUser));
  // 방이 다시 대기 상태가 되었으므로 로비 목록에 노출
  scheduleLobbyBroadcast(io);
  return gameEndResult;
}

/**
 * 게임 도중 플레이어가 나갔을 때 남은 플레이어에게 상태를 반영한다.
 * @param {Object} leaveResult - roomService.leaveRoom 반환값
 */
async function syncAfterPlayerLeft(io, leaveResult) {
  if (!leaveResult || !leaveResult.wasPlaying || !leaveResult.room) return;
  const ended = await finishGameIfEnded(io, leaveResult.room);
  if (!ended) emitGameState(io, leaveResult.room);
}

module.exports = {
  emitHand,
  emitGameState,
  finishGameIfEnded,
  syncAfterPlayerLeft,
};
