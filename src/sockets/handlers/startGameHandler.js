const { getRoomById } = require('../../services/roomService');
const { startGame } = require('../../services/gameService');

const handleStartGame = (socket, data) => {
  const { roomId } = data;

  try {
    const room = getRoomById(roomId);
    if (!room) throw new Error('Room not found.');

    const gameState = startGame(room); // 게임 시작 로직 호출
    socket.to(roomId).emit('gameStarted', gameState); // 방 내 사용자들에게 알림
    socket.emit('gameStarted', gameState); // 본인에게 게임 상태 전송
  } catch (error) {
    socket.emit('error', { message: error.message });
  }
};

module.exports = handleStartGame;
