// 필요한 모듈들을 가져옵니다.
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const { v4: uuidv4 } = require('uuid');

// 정적 파일을 제공하기 위해 public 폴더를 지정합니다.
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));

// 루트 페이지를 처리합니다.
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/view/index.html');
});

// 연결된 모든 클라이언트의 정보를 저장하는 객체
const connectedClients = {};
// 연결된 방 리스트들의 정보를 저장하는 객체
const roomList = [];

// Socket.IO 이벤트 핸들러를 설정합니다.
io.on('connection', (socket) => {
  console.log('새로운 클라이언트가 연결되었습니다.');

    // 기본 이름을 지정하고 클라이언트에게 전달
  const defaultName = `User ${socket.id}`;
  connectedClients[socket.id] = defaultName;
  socket.emit('connecting', defaultName);
  
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

  // 새로운 게임 방을 만들었을 때 실행됩니다.
  // socket.on('createRoom',(roomName) => {
  //   console.log("방 생성 요청");
  //   const roomId = uuidv4();
  //   if(roomName == ''){
  //     roomName = connectedClients[socket.id] + '님의 게임';
  //   }
  //   createRoom(socket, roomName);

   
  //   io.emit('roomList', JSON.stringify(roomList), ()=>{
  //     console.log('roomList 전송 완료')
  //   });

  //   socket.join(roomName);
  //   console.log(roomList);
  //   console.log(roomList[roomId]);
    
  //   socket.emit('createResult', createRoomResult(roomList[roomId])) ;
  // })

  // 방 생성 요청 받으면 새로운 방 생성 및 성공 응답 전송
  // 1. roomName이 같은 방이 있는지 확인
  // 2. roomName이 같은 방이 없으면 새로운 방을 생성한다.
  // 2-1. rooom 객체는 roomList에 새로운 랜덤시드로 roomId 생성 
  //  - 랜덤시드로 만든다고해도 우연으로 같은 roomId가 될 수도 있으니 같은 roomId가 있으면 한번 더 만들기 -> 해당기능 function으로 빼기


  socket.on('createRoom', (roomName) => {
    console.log(`방 생성 요청 받음 - 방 이름: ${roomName}`);
    // const roomId = socket.id;
    createRoom(socket, roomName);

    // if (!roomList[roomId]) {
    //   // 해당 roomId에 방이 없을 경우에만 새로 생성
    //   roomList[roomId] = {
    //     name: roomName,
    //     users: [],
    //     status: 'waiting'
    //   };
    //   console.log(`방 생성 완료 - roomId: ${roomId}`);
    //   // callback(true, roomId);
    // } else {
    //   console.log(`방 생성 실패 - 이미 존재하는 roomId: ${roomId}`);
    //   // callback(false, roomId);
    // }

    io.emit('roomList', JSON.stringify(roomList), ()=>{
      console.log('roomList 전송 완료')
    });
  });

  // 방 새로고침 요청
  socket.on('roomList', () => {
    console.log('방 새로고침 요청');
    console.log(roomList);
    socket.emit('roomList', roomList.filter(room => room.status === 'waiting'), ()=>{
      console.log('roomList 전송 완료')
    });
  })
});
// socket end

// function start
function createRoomResult(room){
  return {
    success: true,
    message: '요청 처리 완료',
    roomInfo: room
  };
}
// 방을 생성하는 함수
function createRoom(socket, data) {
    const { roomName } = data;

    // 이미 같은 이름의 방이 존재하는지 확인
    const existingRoom = roomList.find(room => room.name === roomName);
    console.log("roomName: " ,roomName) ;
    if (existingRoom) {
      socket.emit('createRoomError', '이미 같은 이름의 방이 존재합니다.');
      return;
    }

    // 방 정보를 추가하고, 해당 방의 id를 반환
    const roomId = createRoomId();  
    // roomList.push({
    //   id: roomId,
    //   name: roomName,
    //   users: [{
    //     id: socket.id,
    //     name: connectedClients[socket.id],
    //     readyStatus : 'waiting'
    //   }],
    //   status: 'waiting'
    // });

    roomList[roomId] ={
      name: data,
      users: [{
        id: socket.id,
        name: connectedClients[socket.id],
        readyStatus : 'waiting'
      }],
      status: 'waiting'
    };

    // 해당 방에 참여하도록 설정
    socket.join(roomId);

    console.log(roomList[roomId]);
    // 방 정보를 생성한 클라이언트에게 반환
    socket.emit('roomCreated', roomList[roomId]);

  }

  //2-1. rooomID 생성 함수
  function createRoomId(){    
    let isComple = true;
    console.log(roomList);
    let roomId = "";
    while(isComple){
      roomId = uuidv4();
      if(!roomList.find(room => room.id === roomId)){
        isComple = false;
      }
    }    
    return roomId;
  }

// function end

// 서버를 시작합니다.
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 ${PORT}번 포트에서 시작되었습니다.`);
});
