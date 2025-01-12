const { joinRoom } = require('../../services/userService');

const handleJoinRoom = (socket, data) => {
  const { userId, roomId } = data;
  try {
    joinRoom(userId, roomId);
    socket.join(roomId);
    socket.to(roomId).emit('userJoined', { userId });
  } catch (error) {
    socket.emit('error', { message: error.message });
  }
};

module.exports = handleJoinRoom;
