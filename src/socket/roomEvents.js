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
  socket.on('createRoom', async (roomName, maxCnt) => {
    try {
      console.log(`[Room] 방 생성 요청 - 이름: ${roomName}, 최대인원: ${maxCnt}`);

      const room = await roomService.createRoom(socket.id, roomName, maxCnt);
      socket.join(room.id);
      socket.emit('roomCreated', room);

      const rooms = await roomService.getWaitingRooms();
      io.emit('roomList', rooms);

      console.log(`[Room] 방 생성 완료 - ID: ${room.id}, 이름: ${room.name}`);
    } catch (error) {
      console.error('[createRoom Error]', error);
      socket.emit('createRoomError', error.message);
    }
  });

  /**
   * 방 목록 조회 이벤트
   */
  socket.on('roomList', async () => {
    try {
      const rooms = await roomService.getWaitingRooms();
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
  socket.on('joinRoom', async (roomId) => {
    try {
      console.log(`[Room] 방 입장 요청 - 방 ID: ${roomId}`);

      const room = await roomService.joinRoom(socket.id, roomId);
      socket.join(roomId);
      clearGameCountdown(io, roomId, 'user-joined');
      socket.emit('successJoinRoom', room);
      socket.to(roomId).emit('joinUser', {
        users: room.users,
        maxUserCnt: room.maxUserCnt
      });

      const rooms = await roomService.getWaitingRooms();
      io.emit('roomList', rooms);

      const userName = await userService.getUserName(socket.id);
      console.log(`[Room] 방 입장 완료 - 방: ${room.name}, 사용자: ${userName}`);
    } catch (error) {
      console.error('[joinRoom Error]', error);
      socket.emit('faildJoinRoom', error.message);
    }
  });

  /**
   * 방 나가기 이벤트
   */
  socket.on('leaveRoom', async (roomId) => {
    try {
      console.log(`[Room] 방 나가기 요청 - 방 ID: ${roomId}`);

      const result = await roomService.leaveRoom(socket.id, roomId);
      socket.leave(roomId);
      clearGameCountdown(io, roomId, 'user-left');
      socket.emit('leaveRoomResult', {
        status: 200,
        message: 'successLeaveRoom'
      });

      if (!result.roomRemoved) {
        socket.to(roomId).emit('leaveUser', {
          users: result.updatedUsers,
          newManager: result.newManager
        });
      }

      const rooms = await roomService.getWaitingRooms();
      io.emit('roomList', rooms);

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
