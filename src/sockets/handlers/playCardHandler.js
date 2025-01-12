const { getRoomById } = require('../../services/roomService');
const { playCard } = require('../../services/gameService');

const handlePlayCard = (socket, data) => {
  const { roomId, userId, card } = data;

  try {
    const room = getRoomById(roomId);
    if (!room) throw new Error('Room not found.');

    const gameState = playCard(room, userId, card); // 카드 플레이 로직 호출
    socket.to(roomId).emit('cardPlayed', { userId, card }); // 다른 사용자들에게 카드 정보 전송
    socket.emit('gameState', gameState); // 본인에게 최신 게임 상태 전송
  } catch (error) {
    socket.emit('error', { message: error.message });
  }
};

module.exports = handlePlayCard;
