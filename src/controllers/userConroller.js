// /controllers/userController.js
const userService = require('../services/userService');

exports.changeName = (socket, io, newName) => {
  try {
    userService.updateUserName(socket.id, newName);
    socket.emit('name change successful', newName);
  } catch (error) {
    socket.emit('name change error', error.message);
  }
};

exports.chatMessage = (socket, io, msg) => {
  console.log(`메시지 from ${socket.id}: ${msg}`);
  // 전체 유저에게 전달
  io.emit('chat message', msg);
};