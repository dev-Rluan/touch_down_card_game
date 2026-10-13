/**
 * Socket.IO 초기화 및 이벤트 바인딩
 */
const userEvents = require('./userEvents');
const roomEvents = require('./roomEvents');
const gameEvents = require('./gameEvents');
const chatEvents = require('./chatEvents');
const feedbackEvents = require('./feedbackEvents');
const latency = require('../utils/latency');
const { limiters } = require('../utils/socketRateLimiter');

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
    chatEvents(socket, io);
    feedbackEvents(socket, io);

    // 네트워크 지연 측정 (서버 → 클라이언트 왕복)
    latency.startProbe(socket);
    // 클라이언트 시계 맞추기: 서버 시각을 바로 돌려준다 (클라이언트가 핑과 시계 차이를 계산)
    socket.on('timeSync', (ack) => {
      if (typeof ack !== 'function' || !limiters.timeSync.allow(socket.id)) return;
      ack(Date.now());
    });
  });
};
