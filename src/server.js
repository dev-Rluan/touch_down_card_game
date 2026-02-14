// 필요한 모듈들을 가져옵니다.
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

// Socket.IO 이벤트 핸들러 초기화
const socketEvent = require('./socket/socketEvent');
const { ensureRedisConnection } = require('./config/redisClient');

// 정적 파일을 제공하기 위해 public 폴더를 지정합니다.
app.set('views', __dirname + '/views');
app.use('/public', express.static(__dirname + '/public'));

// 클라이언트용 환경 변수 스크립트 제공
app.get('/env.js', (req, res) => {
  const socketUrl = process.env.CLIENT_SOCKET_SERVER_URL || process.env.SOCKET_SERVER_URL || '';
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`window.__TOUCHDOWN_SOCKET_URL__ = ${JSON.stringify(socketUrl)};`);
});

// 루트 페이지를 처리합니다.
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/view/index.html');
});

// Socket.IO 이벤트 핸들러 등록
socketEvent(io);

// 서버를 시작합니다.
const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    await ensureRedisConnection();
    server.listen(PORT, () => {
      console.log(`[Server] 서버가 ${PORT}번 포트에서 시작되었습니다.`);
      console.log(`[Server] 접속 URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[Server] Redis 초기화 실패', error);
    process.exit(1);
  }
}

bootstrap();
