// 필요한 모듈들을 가져옵니다.
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const { v4: uuidv4 } = require('uuid');

// 서비스 모듈들
const roomService = require('./services/roomService');
const userService = require('./services/userServices');
const gameService = require('./services/gameService');

// 방별 게임 시작 카운트다운 타이머 관리
const gameStartTimers = new Map(); // roomId -> { intervalId, timeoutId, secondsLeft }

/**
 * 방의 게임 시작 카운트다운을 취소하고 알림을 전송합니다.
 * @param {string} roomId
 * @param {string} reason
 */
function clearGameCountdown(roomId, reason = 'canceled') {
  const timers = gameStartTimers.get(roomId);
  if (timers) {
    if (timers.intervalId) clearInterval(timers.intervalId);
    if (timers.timeoutId) clearTimeout(timers.timeoutId);
    gameStartTimers.delete(roomId);
    io.to(roomId).emit('gameCountdownCanceled', { reason });
  }
}

/**
 * 모든 유저가 ready 상태이고 2명 이상인지 재검증합니다.
 * @param {Object} room
 * @returns {boolean}
 */
function canStartGame(room) {
  if (!room) return false;
  if (!Array.isArray(room.users) || room.users.length < 2) return false;
  return room.users.every(u => u.readyStatus === 'ready');
}

/**
 * 방에 대한 게임 시작 카운트다운을 시작합니다.
 * @param {string} roomId
 */
function startGameCountdown(roomId) {
  // 중복 실행 방지: 기존 타이머 제거
  clearGameCountdown(roomId, 'restarting');

  const room = roomService.getRoomById(roomId);
  if (!canStartGame(room)) return; // 조건 불충족 시 무시

  const totalSeconds = 3;
  let secondsLeft = totalSeconds;
  io.to(roomId).emit('gameCountdownStart', { total: totalSeconds });

  const intervalId = setInterval(() => {
    secondsLeft -= 1;
    if (secondsLeft > 0) {
      io.to(roomId).emit('gameCountdown', { secondsLeft });
    }
  }, 1000);

  const timeoutId = setTimeout(() => {
    // 종료 시점 재검증
    const latestRoom = roomService.getRoomById(roomId);
    if (!canStartGame(latestRoom)) {
      clearGameCountdown(roomId, 'condition-changed');
      return;
    }

    // 타이머 정리 후 게임 시작
    clearGameCountdown(roomId, 'completed');
    try {
      const gameStartData = gameService.startGame(roomId);
      // 공개 정보만 브로드캐스트
      const publicData = {
        roomId: gameStartData.id,
        status: gameStartData.status,
        players: gameStartData.users.map(u => ({
          id: u.id,
          name: u.name,
          cardCount: Array.isArray(u.cardPack) ? u.cardPack.length : 0,
          readyStatus: u.readyStatus,
          manager: u.manager
        })),
        currentTurn: gameStartData.gameState?.currentTurn ?? 0,
        centerCards: gameStartData.gameState?.centerCards?.length ?? 0
      };
      io.to(roomId).emit('gameStart', {
        message: '게임이 시작됩니다!',
        gameData: publicData
      });

      // 각 플레이어에게 자신의 핸드 개별 전송
      const latestRoom = roomService.getRoomById(roomId);
      if (latestRoom && Array.isArray(latestRoom.users)) {
        latestRoom.users.forEach(u => {
          try {
            io.to(u.id).emit('yourHand', { cards: u.cardPack || [] });
          } catch (e) {
            console.error('[yourHand emit Error]', e);
          }
        });
      }

      setTimeout(() => {
        try {
          const gameState = gameService.getGameState(roomId);
          io.to(roomId).emit('gameState', gameState);
        } catch (err) {
          console.error('[gameState emit after start Error]', err);
        }
      }, 100);
    } catch (error) {
      console.error('[Game Start Error]', error);
      io.to(roomId).emit('gameStartError', error.message);
    }
  }, totalSeconds * 1000);

  gameStartTimers.set(roomId, { intervalId, timeoutId, secondsLeft });
  // 즉시 최초 카운트다운 표시
  io.to(roomId).emit('gameCountdown', { secondsLeft });
}

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
      // 카운트다운 중이었다면 조건 변경으로 취소
      clearGameCountdown(roomId, 'user-joined');
      
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
      // 카운트다운 취소 (인원/준비상태 변화)
      clearGameCountdown(roomId, 'user-left');
      
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
        
        // 모든 사용자가 준비되었는지 확인 및 카운트다운 제어
        const allReady = currentRoom.users.every(u => u.readyStatus === 'ready');
        if (allReady && currentRoom.users.length >= 2) {
          io.to(currentRoom.id).emit('allReady', currentRoom.users);
          startGameCountdown(currentRoom.id);
        } else {
          // 조건 불충족 시 카운트다운 취소
          clearGameCountdown(currentRoom.id, 'not-all-ready');
        }
        
        console.log(`[Game] 준비 상태 변경 - 사용자: ${user.name}, 상태: ${user.readyStatus}`);
      }
    } catch (error) {
      console.error('[ready Error]', error);
      socket.emit('readyError', error.message);
    }
  });

  /**
   * 게임 상태 조회 이벤트
   */
  socket.on('getGameState', () => {
    try {
      const currentRoom = roomService.getRoomByUser(socket.id);
      if (!currentRoom) {
        socket.emit('gameStateError', '참여 중인 방이 없습니다.');
        return;
      }

      const gameState = gameService.getGameState(currentRoom.id);
      socket.emit('gameState', gameState);
    } catch (error) {
      console.error('[getGameState Error]', error);
      socket.emit('gameStateError', error.message);
    }
  });

  /**
   * 카드 내기 이벤트
   */
  socket.on('playCard', (cardIndex) => {
    try {
      const currentRoom = roomService.getRoomByUser(socket.id);
      if (!currentRoom) {
        socket.emit('playCardError', '참여 중인 방이 없습니다.');
        return;
      }

      const result = gameService.playCard(currentRoom.id, socket.id, cardIndex);
      
      // 모든 플레이어에게 카드 내기 결과 전송
      io.to(currentRoom.id).emit('cardPlayed', {
        playerId: socket.id,
        playerName: userService.getUserName(socket.id),
        result: result
      });

      // 각 플레이어에게 업데이트된 핸드 전송
      const latestRoom = roomService.getRoomById(currentRoom.id);
      if (latestRoom && Array.isArray(latestRoom.users)) {
        latestRoom.users.forEach(u => {
          try {
            io.to(u.id).emit('yourHand', { cards: u.cardPack || [] });
          } catch (e) {
            console.error('[yourHand update Error]', e);
          }
        });
      }

      // 게임 종료 확인
      const gameEndResult = gameService.checkGameEnd(currentRoom.id);
      if (gameEndResult.isEnded) {
        io.to(currentRoom.id).emit('gameEnd', gameEndResult);
      }

      console.log(`[Game] 카드 내기 - 플레이어: ${userService.getUserName(socket.id)}, 카드 인덱스: ${cardIndex}`);
    } catch (error) {
      console.error('[playCard Error]', error);
      socket.emit('playCardError', error.message);
    }
  });

  /**
   * 할리갈리 이벤트
   */
  socket.on('halliGalli', () => {
    try {
      const currentRoom = roomService.getRoomByUser(socket.id);
      if (!currentRoom) {
        socket.emit('halliGalliError', '참여 중인 방이 없습니다.');
        return;
      }

      const result = gameService.handleHalliGalli(currentRoom.id, socket.id);
      
      // 모든 플레이어에게 할리갈리 결과 전송
      io.to(currentRoom.id).emit('halliGalliResult', {
        playerId: socket.id,
        playerName: userService.getUserName(socket.id),
        success: result.success,
        scoreGained: result.scoreGained || 0,
        centerCardsGained: result.centerCardsGained || 0,
        discardedCardsGained: result.discardedCardsGained || 0,
        newScore: result.newScore || 0,
        discardedCard: result.discardedCard,
        centerCards: result.centerCards,
        discardedCards: result.discardedCards
      });

      // 게임 상태 업데이트
      setTimeout(() => {
        const gameState = gameService.getGameState(currentRoom.id);
        io.to(currentRoom.id).emit('gameState', gameState);
      }, 100);

      console.log(`[Game] 할리갈리 - 플레이어: ${userService.getUserName(socket.id)}, 성공: ${result.success}`);
    } catch (error) {
      console.error('[halliGalli Error]', error);
      socket.emit('halliGalliError', error.message);
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
        // 카운트다운 취소 (인원/준비상태 변화)
        clearGameCountdown(currentRoom.id, 'user-disconnected');
        
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
