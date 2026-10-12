/**
 * 게임 중 누군가 나간(또는 연결이 끊긴) 직후, 남은 플레이어들의 화면을 서버 상태에 맞춘다.
 *  - 남은 사람만으로 게임이 끝나는 상황(카드가 있는 사람이 1명 이하)이면 gameEnd 를 보낸다.
 *  - 아니면 최신 gameState(플레이어 목록, 차례)를 보낸다. 클라이언트는 이 값을 받기 전까지
 *    낡은 플레이어 목록으로 "내 차례"를 계산하므로, 보내지 않으면 차례 보유자가 나갔을 때 아무도 카드를 낼 수 없다.
 * 호출자는 해당 방의 락을 잡고 있어야 한다.
 */
const roomService = require('../services/roomService');
const gameService = require('../services/gameService');

async function syncGameAfterLeave(io, roomId) {
  const room = await roomService.getRoomById(roomId);
  if (!room || room.status !== 'playing' || !room.gameState) return;

  const ended = await gameService.checkGameEnd(roomId, room);
  if (ended.isEnded) {
    io.to(roomId).emit('gameEnd', ended);
    return;
  }
  io.to(roomId).emit('gameState', gameService.buildGameState(room));
}

module.exports = { syncGameAfterLeave };
