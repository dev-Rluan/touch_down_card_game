/**
 * 방 관리 관련 Socket.IO 이벤트 핸들러
 */
const roomService = require('../services/roomService');
const userService = require('../services/userServices');
const { clearGameCountdown } = require('../utils/gameCountdown');

/**
 * 방 관리 관련 이벤트 핸들러 등록
 * @param {Socket} socket - Socket.IO Socket Instance
 * @param {Server} io - Socket.IO Server Instance
 */
module.exports = function(socket, io) {
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
      clearGameCountdown(io, roomId, 'user-joined');
      
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
      clearGameCountdown(io, roomId, 'user-left');
      
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
};

