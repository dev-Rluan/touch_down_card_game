// 필요한 모듈들을 가져옵니다.
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);

// 정적 파일을 제공하기 위해 public 폴더를 지정합니다.
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));

// 루트 페이지를 처리합니다.
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/view/index.html');
});

// 연결된 모든 클라이언트의 정보를 저장하는 객체
const connectedClients = {};

// Socket.IO 이벤트 핸들러를 설정합니다.
io.on('connection', (socket) => {
  console.log('새로운 클라이언트가 연결되었습니다.');

    // 기본 이름을 지정하고 클라이언트에게 전달
  const defaultName = `User ${socket.id}`;
  socket.emit('change name', defaultName);
  
  // 클라이언트에서 이름 변경 시
  socket.on('change name', (name) => {
    console.log(`User ${socket.id} changed name to ${name}`);
    connectedClients[socket.id] = name;
    socket.emit('name change successful',name);
  });

  // 클라이언트로부터 'chat message' 이벤트를 받았을 때 실행됩니다.
  socket.on('chat message', (msg) => {
    console.log('메시지: ' + msg);
    // 모든 클라이언트에게 'chat message' 이벤트와 메시지를 전송합니다.
    io.emit('chat message', msg);
  });

  // 클라이언트와의 연결이 끊어졌을 때 실행됩니다.
  socket.on('disconnect', () => {
    console.log('클라이언트와의 연결이 끊어졌습니다.');
  });
});

// 서버를 시작합니다.
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 ${PORT}번 포트에서 시작되었습니다.`);
});
