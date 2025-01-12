const { getRoomById } = require('../../services/roomService');
const { endGame } = require('../../services/gameService');

const handleEndGame = (socket, data) => {
  const { roomId } = data;

  try {
    const room = getRoomById(roomId);
    if (!room) throw new Error('Room not found.');

    const finalState = endGame(room); // 게임 종료 로직 호출
    socket.to(roomId).emit('gameEnded', finalState); // 방 내 사용자들에게 알림
    socket.emit('gameEnded', finalState); // 본인에게 게임 종료 상태 전송
  } catch (error) {
    socket.emit('error', { message: error.message });
  }
};

module.exports = handleEndGame;
