/**
 * 방 관리 관련 Socket.IO 이벤트 핸들러
 */
const roomService = require('../services/roomService');
const { clearGameCountdown } = require('../utils/gameCountdown');
const { limiters } = require('../utils/socketRateLimiter');
const { withRoomLock } = require('../utils/roomLock');
const { toPublicRoom, toPublicUser } = require('../utils/roomSerializer');
const { scheduleLobbyBroadcast } = require('./lobbyBroadcast');
const { syncAfterPlayerLeft } = require('./gameSync');

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
    if (!limiters.roomAction.allow(socket.id)) {
      socket.emit('createRoomError', '요청이 너무 빠릅니다. 잠시 후 다시 시도하세요.');
      return;
    }
    try {
      console.log(`[Room] 방 생성 요청 - 이름: ${roomName}, 최대인원: ${maxCnt}`);

      const room = await roomService.createRoom(socket.id, roomName, maxCnt);
      socket.leave('lobby');  // 방 생성 → 로비 룸 탈퇴
      socket.join(room.id);
      socket.emit('roomCreated', toPublicRoom(room));
      scheduleLobbyBroadcast(io);

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
      const rooms = await roomService.getWaitingRoomSummaries();
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
    if (!limiters.roomAction.allow(socket.id)) {
      socket.emit('faildJoinRoom', '요청이 너무 빠릅니다. 잠시 후 다시 시도하세요.');
      return;
    }
    try {
      console.log(`[Room] 방 입장 요청 - 방 ID: ${roomId}`);

      const room = await withRoomLock(roomId, () => roomService.joinRoom(socket.id, roomId));
      socket.leave('lobby');  // 방 입장 → 로비 룸 탈퇴
      socket.join(roomId);
      clearGameCountdown(io, roomId, 'user-joined');
      const publicRoom = toPublicRoom(room);
      socket.emit('successJoinRoom', publicRoom);
      socket.to(roomId).emit('joinUser', {
        users: publicRoom.users,
        maxUserCnt: room.maxUserCnt
      });
      scheduleLobbyBroadcast(io);

      console.log(`[Room] 방 입장 완료 - 방: ${room.name}, 사용자: ${socket.id}`);
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

      const result = await withRoomLock(roomId, async () => {
        const leaveResult = await roomService.leaveRoom(socket.id, roomId);
        // 나간 사람에게 게임 종료/상태 이벤트가 가지 않도록 먼저 소켓 룸에서 뺀다
        socket.leave(roomId);
        await syncAfterPlayerLeft(io, leaveResult);
        return leaveResult;
      });
      socket.join('lobby');  // 방 퇴장 → 로비 룸 재입장
      clearGameCountdown(io, roomId, 'user-left');
      socket.emit('leaveRoomResult', {
        status: 200,
        message: 'successLeaveRoom'
      });

      if (!result.roomRemoved) {
        socket.to(roomId).emit('leaveUser', {
          users: result.updatedUsers.map(toPublicUser),
          newManager: result.newManager ? toPublicUser(result.newManager) : null
        });
      }
      scheduleLobbyBroadcast(io);

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
