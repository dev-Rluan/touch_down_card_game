/**
 * 채팅 이벤트 핸들러 — 같은 방 안의 플레이어에게만 전달한다.
 *
 * 방 ID 는 Redis 조회 없이 소켓이 참가한 Socket.IO 룸에서 찾는다
 * (소켓은 자기 ID 룸, 로비 룸, 입장한 방 룸에 속한다). 닉네임만 HGET 1회로 조회한다.
 */
const userService = require('../services/userServices');
const { limiters } = require('../utils/socketRateLimiter');
const { sanitizeChatMessage } = require('../utils/chat');

function findGameRoomId(socket) {
  for (const room of socket.rooms || []) {
    if (room !== socket.id && room !== 'lobby') return room;
  }
  return null;
}

module.exports = function(socket, io) {
  socket.on('chat message', async (message) => {
    try {
      if (!limiters.chat.allow(socket.id)) {
        socket.emit('chatError', '메시지를 너무 빨리 보내고 있습니다. 잠시 후 다시 시도하세요.');
        return;
      }

      const text = sanitizeChatMessage(message);
      if (!text) return;

      const roomId = findGameRoomId(socket);
      if (!roomId) {
        socket.emit('chatError', '방에 입장한 뒤에 채팅할 수 있습니다.');
        return;
      }

      const name = await userService.getUserName(socket.id);
      if (!name) return;

      io.to(roomId).emit('chat message', {
        userId: socket.id,
        name,
        text,
        ts: Date.now(),
      });
    } catch (error) {
      console.error('[chat message Error]', error);
    }
  });
};
