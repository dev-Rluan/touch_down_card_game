// /socket/userEvents.js
const userController = require('../controllers/userController');

module.exports = (socket, io) => {
  // 닉네임 변경
  socket.on('change name', (newName) => {
    userController.changeName(socket, io, newName);
  });

  // 채팅
  socket.on('chat message', (msg) => {
    userController.chatMessage(socket, io, msg);
  });
};