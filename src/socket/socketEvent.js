/**
 * Socket.IO 초기화 및 이벤트 바인딩
 */
const userEvents = require('./userEvents');
const roomEvents = require('./roomEvents');
const gameEvents = require('./gameEvents');

/**
 * Socket.IO 서버 초기화
 * @param {Server} io - Socket.IO Server Instance
 */
module.exports = function(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] 새로운 연결: ${socket.id}`);
    
    // 기능별 이벤트 핸들러 등록
    userEvents(socket, io);
    roomEvents(socket, io);
    gameEvents(socket, io);
  });
};
