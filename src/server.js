// -- 서버 섹션 시작
//  필요한 모듈들을 가져옵니다.
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

// -- 서버 섹션 종료

// 연결된 모든 클라이언트의 정보를 저장하는 객체
const connectedClients = {};
// 연결된 방 리스트들의 정보를 저장하는 객체
const roomList = [];

// Socket.IO 이벤트 핸들러를 설정합니다.
io.on('connection', (socket) => {
  console.log('새로운 클라이언트가 연결되었습니다.');

    // 기본 이름을 지정하고 클라이언트에게 전달
  const defaultName = `User ${socket.id}`;
  connectedClients[socket.id] = {name: defaultName, roomId: ''};

  const result = {nickname:  connectedClients[socket.id].name, roomList:roomList.filter(room => room.status === 'waiting')}
  socket.emit('connecting', result);
  
  // 클라이언트에서 이름 변경 시
  socket.on('change name', (name) => {
    console.log(`User ${socket.id} changed name to ${name}`);
    connectedClients[socket.id].name = name;
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
    const roomId = connectedClients[socket.id].roomId;
    console.log(roomId);
    if(roomId != ''){
      console.log('방삭제로직시작');
      let roomInfo = roomList.find(room => room.id ===roomId);
      if(roomInfo){
        if(roomInfo.users.length <= 1){
          var index = roomList.findIndex(room => room.id === roomId);
          console.log('test');
          roomList.splice(index, 1);    
        }else{
          roomInfo.users = roomInfo.users.filter(user => user.id != socket.id);
          socket.to(roomId).emit('leaveUser');
        }    
      }
      console.log(roomInfo);

      // roomList.find(room => room.id === roomId).users.filter(user => user.id != socket.id);
      socket.leave(connectedClients[socket.id].roomId);
      
      console.log(roomList);
        console.log('방삭제로직종료');
    }

    io.emit('roomList',roomList.filter(room => room.status === 'waiting'), ()=>{
      console.log('roomList 전송 완료')
    });
    

    console.log('클라이언트와의 연결이 끊어졌습니다.');
  });

  // 방 생성 요청 받으면 새로운 방 생성 및 성공 응답 전송
  // 1. roomName이 같은 방이 있는지 확인
  // 2. roomName이 같은 방이 없으면 새로운 방을 생성한다.
  // 2-1. rooom 객체는 roomList에 새로운 랜덤시드로 roomId 생성 
  //  - 랜덤시드로 만든다고해도 우연으로 같은 roomId가 될 수도 있으니 같은 roomId가 있으면 한번 더 만들기 -> 해당기능 function으로 빼기


  socket.on('createRoom', (roomName, maxCnt) => {
    console.log(`방 생성 요청 받음 - 방 이름: ${roomName}`);
    // const roomId = socket.id;
    createRoom(socket, roomName, maxCnt);

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

    io.emit('roomList',roomList.filter(room => room.status === 'waiting'), ()=>{
      console.log('roomList 전송 완료')
    });
  });

  // 방 새로고침 요청
  socket.on('roomList', () => {
    console.log('방 새로고침 요청');
    console.log(roomList);
    console.log('=============1');

    // console.log(roomList.);

    console.log(roomList.filter(room => room.status === 'waiting'));
    socket.emit('roomList', roomList.filter(room => room.status === 'waiting'), ()=>{
      console.log('============');
      console.log(roomList.filter(room => room.status === 'waiting'));
      console.log('roomList 전송 완료')
    });
  })
  socket.on('joinRoom', (roomId) =>{
    console.log(roomId);
    console.log('방 입장 요청');
    console.log(roomList);
    const room = roomList.find(room => room.id === roomId);
    console.log(room);
    if(room.maxUserCnt <= room.users.length ){
      socket.emit('faildJoinRoom');
      console.log('faildJoinRoom : maxRoom');
    }else{
      
      console.log('방입장성공');
      socket.join(roomId);
      connectedClients[socket.id].roomId = roomId;
      // socket.to(roomId).emit('reviceMessage');
      let userInfo = {
        id: socket.id,
        name: connectedClients[socket.id].name,
        readyStatus : 'waiting', 
        score : 0,
        order : 0, // 게임 시작시 초기화
        manager : false,
        cardPack : []      
      };
      
      roomList.find(room => room.id === roomId).users.push(userInfo);
      socket.to(roomId).emit('joinUser', roomList.find(room => room.id === roomId).users, roomList.find(room => room.id === roomId).maxUserCnt);
      socket.emit('successJoinRoom', roomList.find(room => room.id === roomId));
      console.log('결과반환 완료');
    }
  })

  socket.on('ready', () => {
    // socket.id가 속한 방을 찾는다
    const userRoomId = connectedClients[socket.id]?.roomId;
    if (!userRoomId) return;

    const roomInfo = roomList.find(room => room.id === userRoomId);
    if (!roomInfo) return;

    // 해당 유저의 readyStatus를 true로 변경
    const user = roomInfo.users.find(user => user.id === socket.id);
    if (user) user.readyStatus = true;

    // 모든 유저의 readyStatus가 true면 게임 시작 로직 등 추가 가능

    // 상태를 방의 모든 유저에게 전송
    io.to(userRoomId).emit('readyStatusChanged', roomInfo.users);

    // (필요시) 콘솔 로그
    console.log(`[ready] ${socket.id} is ready in room ${userRoomId}`);
  });

  socket.on('leaveRoom', (roomId)=>{
    // 현재 접속중인 방에서 나가기
    // 나가기 반환 함수 실행

    if(roomId != ''){
      console.log('방삭제로직시작');
      console.log("roomId : " + roomId);
      let index = roomList.findIndex(room=> room.id === roomId);
      let roomInfo = roomList.find(room => room.id ===roomId);
      console.log("시작전 RoomInfo 확인 \n" + roomInfo);
      if(roomInfo){
        console.log('테스트1');
        if(roomInfo.users.length <= 1){
          console.log('테스트2');
          
          
          roomList.splice(index, 1);   
          //roomList.filter(room => room.id !== roomId);    
        }else{
          console.log('테스트33');
          // 유저가 방장인지 확인
          // 바꿀 유저 찾고
          // 유저 객체변경
          // 바뀐 
          console.log("testsssssss");
          console.log(roomInfo.users.filter(user => user.id == socket.id));
          if(roomList[index].users.filter(user => user.id == socket.id)[0].manager){
            console.log('테스트4');
            const tempManger = roomList[index].users.findIndex(user => user.manager === false);
            // roomInfo.users = roomInfo.users.filter(user => user.id != socket.id)[0];
            roomList[index].users[tempManger].manager = true;
            console.log(roomList[index]);
          } 

          roomInfo.users = roomInfo.users.filter(user => user.id != socket.id);
          socket.to(roomId).emit('leaveUser', getLeaveRoomInfo(index));
        }        
      }

      

      console.log("삭제후 RoomInfo 확인 \n" + roomInfo.users);
      console.log(roomInfo);
      console.log(roomInfo.users);
      console.log("삭제후 roomList 확인 \n" + roomList[index]);
      console.log(roomList[index].users);
      // roomList.find(room => room.id === roomId).users.filter(user => user.id != socket.id);
      socket.leave(connectedClients[socket.id].roomId); // socket.io 방 객체에서 방나가기
      connectedClients[socket.id].roomId = ''; // 유저객체 방 초기화
        socket.emit("leaveRoomResult", {status : 200, message : "successLeaveRoom"});

      console.log(roomList);
      io.emit('roomList',roomList.filter(room => room.status === 'waiting'), ()=>{
        console.log('roomList 전송 완료')
      });
      console.log('방삭제로직종료');
    }
    
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
function createRoom(socket, data, maxCnt) {
    const { roomName } = data;

    console.log("max: "+ maxCnt);
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

    roomList.push({
      id : roomId,
      name: data,
      users: [{
        id: socket.id,
        name: connectedClients[socket.id].name,
        readyStatus : 'waiting', 
        score : 0,
        order : 0, // 게임시작시 초기화 
        manager : true,
        cardPack : []      
      }],
      status: 'waiting',
      maxUserCnt : maxCnt,
      upCardList : [],
      turn : 0      
    });

    // 해당 방에 참여하도록 설정
    socket.join(roomId);
    connectedClients[socket.id].roomId = roomId;
    let roomIndex = roomList.findIndex((room)=> room.id === roomId);
    // console.log(roomList[roomId]);
    // 방 정보를 생성한 클라이언트에게 반환
    socket.emit('roomCreated', getReturnRoomInfo(roomIndex));

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
  function setGameRoom(roomId){

  }
  function setRoomUserInfo(roomId, socket){
    return {
      id: socket.id,
        name: connectedClients[socket.id].name,
        readyStatus : 'waiting', 
        score : 0,
        order : getOrder(roomId),
        manager : true,
        cardPack : []      
    }
  }
  function getOrder(roomId){
    return roomList.find((room) => room.id == roomId).users.length + 1;
  }
  function getLeaveRoomInfo(roomId){
    return roomList[roomId].users.map(({cardPack, ...item}) => item);
  }
  function getReturnRoomInfo(roomId){
    let roomInfo = roomList[roomId];
    roomInfo.users = roomList[roomId].users.map(({cardPack, ...item}) => item);
    return roomInfo;
  }

  /*
    유저 객체 반환용 리스트 조회(게임)
  */ 
  function getPlayUsers(roomId){
    let users = roomList[roomIdx];
    let result = [];
    for(const user of users){
      let resultMap = {
        id : user.id,
        name : user.name,
        readyStatus : user.readyStatus,
        score : user.score,
        manager : user.manager
      } 
      result.push(resultMap);
    }
    return result;

  }
  // 레디 상태 변경
  function updateReadyStatus(roomId, userId, status){
    roomList[getRoomIdx(roomId)].users[getUserIdx(roomId,userId)].readyStatus = status;
    return getPlayUsers(roomIdx);
  }

  // 방 번호 구하기
  function getRoomIdx(roomId){
    return roomList.findIndex(room=> room.id === roomId);
  }

  // 방의 유저 번호 구하기
  function getUserIdx(roomId, userId){
    return roomList[getRoomIdx(roomId)].users.findIndex(user => user.id === userId);
  }

  function divCard(){
    // 필요한 로직
    // 1. player만큼 카드를 나눠준다
    // 
    // 2. 플레이어별 카드 덱 정보 저장
    // 3. start player 저장 
    // 4. user별 남은 카드 수 저장
    // end 방안의 유저들에게 줄 객체 반환
    // - {startuser, playerCardDecks[], startTime} -> gameStart event로 보냄
    // 반환 객체 재 정의 필요
  }
  function gameStart(){
    // 인원수만 큼 카드 나누기 
    dicCard();
    // 방 상태 바꾸기

    // 게임상태 바꾸기

  }
  function dropCard(){

  }
  function endGame(){

  }

// function end

// 서버를 시작합니다.
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 ${PORT}번 포트에서 시작되었습니다.`);
});


