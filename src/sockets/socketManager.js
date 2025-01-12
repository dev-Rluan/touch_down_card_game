const handleJoinRoom = require('./handlers/joinRoomHandler');

const initializeSockets = (io) => {
  io.on('connection', (socket) => {
    console.log('New connection established:', socket.id);

    socket.on('joinRoom', (data) => handleJoinRoom(socket, data));
    // Add other event handlers here

    socket.on('disconnect', () => {
      console.log('Connection disconnected:', socket.id);
    });
  });
};

module.exports = initializeSockets;
