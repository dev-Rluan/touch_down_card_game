// /socket/socketEvents.js
const roomEvents = require('./roomEvents');
const gameEvents = require('./gameEvents');
const userEvents = require('./userEvents');
/**
 * Socket.io 초기화 및 이벤트 바인딩
 * @param {Server} io - Socket.IO Server Instance
 */
module.exports = function(io) {
    io.on('connection', (socket) => {
      console.log(`[Socket] Connected: ${socket.id}`);
      
      // 기능별 이벤트 등록
      roomEvents(socket, io);
      gameEvents(socket, io);
      userEvents(socket, io);
  
      // disconnect(공통)
      socket.on('disconnect', () => {
        console.log(`[Socket] Disconnected: ${socket.id}`);
        // 유저 연결 해제 로직 등
      });
    });
  };