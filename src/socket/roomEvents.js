// /socket/roomEvents.js
const roomController = require('../controllers/roomController');

module.exports = (socket, io) => {
  // 방 생성
  socket.on('createRoom', (roomName, maxCnt) => {
    roomController.createRoom(socket, io, roomName, maxCnt);
  });

  // 방 목록 새로고침
  socket.on('roomList', () => {
    roomController.getRoomList(socket);
  });

  // 방 입장
  socket.on('joinRoom', (roomId) => {
    roomController.joinRoom(socket, io, roomId);
  });

  // 방 나가기
  socket.on('leaveRoom', (roomId) => {
    roomController.leaveRoom(socket, io, roomId);
  });
};