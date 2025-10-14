// 필요한 모듈들을 가져옵니다.
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const { v4: uuidv4 } = require('uuid');

// 서비스 모듈들
const roomService = require('./services/roomService');
const userService = require('./services/userServices');

// 정적 파일을 제공하기 위해 public 폴더를 지정합니다.
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));

// 루트 페이지를 처리합니다.
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/view/index.html');
});

/**
 * Socket.IO 이벤트 핸들러 설정
 */
io.on('connection', (socket) => {
  console.log(`[Socket] 새로운 클라이언트 연결: ${socket.id}`);

  // 사용자 연결 처리
  const defaultName = `User_${socket.id.substring(0, 8)}`;
  userService.connectUser(socket.id, defaultName);
  
  // 연결 성공 응답
  const initialData = {
    nickname: defaultName,
    roomList: roomService.getWaitingRooms()
  };
  socket.emit('connecting', initialData);

  /**
   * 닉네임 변경 이벤트
   */
  socket.on('change name', (newName) => {
    try {
      if (!newName || !newName.trim()) {
        socket.emit('name change error', '닉네임을 입력해주세요.');
        return;
      }

      userService.updateUserName(socket.id, newName.trim());
      socket.emit('name change successful', newName.trim());
      console.log(`[User] ${socket.id} 닉네임 변경: ${newName.trim()}`);
    } catch (error) {
      console.error('[change name Error]', error);
      socket.emit('name change error', error.message);
    }
  });

  /**
   * 채팅 메시지 이벤트
   */
  socket.on('chat message', (message) => {
    try {
      if (!message || !message.trim()) {
        return;
      }

      const userName = userService.getUserName(socket.id);
      const chatData = {
        user: userName,
        message: message.trim(),
        timestamp: new Date().toISOString()
      };

      console.log(`[Chat] ${userName}: ${message.trim()}`);
      io.emit('chat message', chatData);
    } catch (error) {
      console.error('[chat message Error]', error);
    }
  });

  /**
   * 방 생성 이벤트
   */
  socket.on('createRoom', (roomName, maxCnt) => {
    try {
      console.log(`[Room] 방 생성 요청 - 이름: ${roomName}, 최대인원: ${maxCnt}`);
      
      const room = roomService.createRoom(socket.id, roomName, maxCnt);
      
      // 소켓을 방에 참여시킴
      socket.join(room.id);
      
      // 방 생성 성공 응답
      socket.emit('roomCreated', room);
      
      // 전체 사용자에게 방 목록 업데이트
      io.emit('roomList', roomService.getWaitingRooms());
      
      console.log(`[Room] 방 생성 완료 - ID: ${room.id}, 이름: ${room.name}`);
    } catch (error) {
      console.error('[createRoom Error]', error);
      socket.emit('createRoomError', error.message);
    }
  });

  /**
   * 방 목록 조회 이벤트
   */
  socket.on('roomList', () => {
    try {
      const rooms = roomService.getWaitingRooms();
      socket.emit('roomList', rooms);
      console.log(`[Room] 방 목록 조회 - ${rooms.length}개 방`);
    } catch (error) {
      console.error('[roomList Error]', error);
      socket.emit('roomListError', error.message);
    }
  });

  /**
   * 방 입장 이벤트
   */
  socket.on('joinRoom', (roomId) => {
    try {
      console.log(`[Room] 방 입장 요청 - 방 ID: ${roomId}`);
      
      const room = roomService.joinRoom(socket.id, roomId);
      
      // 소켓을 방에 참여시킴
      socket.join(roomId);
      
      // 입장 성공 응답
      socket.emit('successJoinRoom', room);
      
      // 같은 방의 다른 사용자들에게 알림
      socket.to(roomId).emit('joinUser', {
        users: room.users,
        maxUserCnt: room.maxUserCnt
      });
      
      // 전체 사용자에게 방 목록 업데이트
      io.emit('roomList', roomService.getWaitingRooms());
      
      console.log(`[Room] 방 입장 완료 - 방: ${room.name}, 사용자: ${userService.getUserName(socket.id)}`);
    } catch (error) {
      console.error('[joinRoom Error]', error);
      socket.emit('faildJoinRoom', error.message);
    }
  });

  /**
   * 방 나가기 이벤트
   */
  socket.on('leaveRoom', (roomId) => {
    try {
      console.log(`[Room] 방 나가기 요청 - 방 ID: ${roomId}`);
      
      const result = roomService.leaveRoom(socket.id, roomId);
      
      // 소켓을 방에서 제거
      socket.leave(roomId);
      
      // 나가기 성공 응답
      socket.emit('leaveRoomResult', {
        status: 200,
        message: 'successLeaveRoom'
      });
      
      // 방이 삭제되지 않았다면 다른 사용자들에게 알림
      if (!result.roomRemoved) {
        socket.to(roomId).emit('leaveUser', {
          users: result.updatedUsers,
          newManager: result.newManager
        });
      }
      
      // 전체 사용자에게 방 목록 업데이트
      io.emit('roomList', roomService.getWaitingRooms());
      
      console.log(`[Room] 방 나가기 완료 - 방 ID: ${roomId}, 방 삭제: ${result.roomRemoved}`);
    } catch (error) {
      console.error('[leaveRoom Error]', error);
      socket.emit('leaveRoomResult', {
        status: 400,
        message: error.message
      });
    }
  });

  /**
   * 준비 상태 변경 이벤트
   */
  socket.on('ready', () => {
    try {
      const currentRoom = roomService.getRoomByUser(socket.id);
      if (!currentRoom) {
        socket.emit('readyError', '참여 중인 방이 없습니다.');
        return;
      }

      // 사용자 준비 상태 변경
      const user = currentRoom.users.find(u => u.id === socket.id);
      if (user) {
        user.readyStatus = user.readyStatus === 'ready' ? 'waiting' : 'ready';
        
        // 방의 모든 사용자에게 준비 상태 업데이트
        io.to(currentRoom.id).emit('updateReadyStatus', currentRoom.users);
        
        // 모든 사용자가 준비되었는지 확인
        const allReady = currentRoom.users.every(u => u.readyStatus === 'ready');
        if (allReady && currentRoom.users.length >= 2) {
          io.to(currentRoom.id).emit('allReady', currentRoom.users);
          
          // 3초 후 게임 시작
          setTimeout(() => {
            io.to(currentRoom.id).emit('gameStart', {
              message: '게임이 시작됩니다!',
              users: currentRoom.users
            });
          }, 3000);
        }
        
        console.log(`[Game] 준비 상태 변경 - 사용자: ${user.name}, 상태: ${user.readyStatus}`);
      }
    } catch (error) {
      console.error('[ready Error]', error);
      socket.emit('readyError', error.message);
    }
  });

  /**
   * 연결 해제 이벤트
   */
  socket.on('disconnect', () => {
    try {
      console.log(`[Socket] 클라이언트 연결 해제: ${socket.id}`);
      
      const currentRoom = roomService.getRoomByUser(socket.id);
      if (currentRoom) {
        // 방에서 사용자 제거
        const result = roomService.leaveRoom(socket.id, currentRoom.id);
        
        // 방이 삭제되지 않았다면 다른 사용자들에게 알림
        if (!result.roomRemoved) {
          socket.to(currentRoom.id).emit('leaveUser', {
            users: result.updatedUsers,
            newManager: result.newManager
          });
        }
        
        // 전체 사용자에게 방 목록 업데이트
        io.emit('roomList', roomService.getWaitingRooms());
      }
      
      // 사용자 정보 제거
      userService.disconnectUser(socket.id);
      
      console.log(`[Socket] 연결 해제 처리 완료: ${socket.id}`);
    } catch (error) {
      console.error('[disconnect Error]', error);
    }
  });
});

// 서버를 시작합니다.
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[Server] 서버가 ${PORT}번 포트에서 시작되었습니다.`);
  console.log(`[Server] 접속 URL: http://localhost:${PORT}`);
});
