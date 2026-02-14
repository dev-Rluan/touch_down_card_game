/**
 * 사용자 관련 Socket.IO 이벤트 핸들러
 */
const userService = require('../services/userServices');
const roomService = require('../services/roomService');
const { clearGameCountdown } = require('../utils/gameCountdown');

/**
 * 사용자 관련 이벤트 핸들러 등록
 * @param {Socket} socket - Socket.IO Socket Instance
 * @param {Server} io - Socket.IO Server Instance
 */
module.exports = function(socket, io) {
  const defaultName = `User_${socket.id.substring(0, 8)}`;
  (async () => {
    try {
      await userService.connectUser(socket.id, defaultName);
      const waitingRooms = await roomService.getWaitingRooms();
      socket.emit('connecting', {
        nickname: defaultName,
        roomList: waitingRooms
      });
    } catch (error) {
      console.error('[connection init Error]', error);
      socket.emit('connecting', {
        nickname: defaultName,
        roomList: [],
        error: '서버 오류가 발생했습니다.'
      });
    }
  })();
  console.log(`[Socket] 새로운 클라이언트 연결: ${socket.id}`);

  /**
   * 닉네임 변경 이벤트
   */
  socket.on('change name', async (newName) => {
    try {
      if (!newName || !newName.trim()) {
        socket.emit('name change error', '닉네임을 입력해주세요.');
        return;
      }

      await userService.updateUserName(socket.id, newName.trim());
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
  socket.on('chat message', async (message) => {
    try {
      if (!message || !message.trim()) {
        return;
      }

      const userName = await userService.getUserName(socket.id);
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
   * 연결 해제 이벤트
   */
  socket.on('disconnect', async () => {
    try {
      console.log(`[Socket] 클라이언트 연결 해제: ${socket.id}`);

      const currentRoom = await roomService.getRoomByUser(socket.id);
      if (currentRoom) {
        const result = await roomService.leaveRoom(socket.id, currentRoom.id);
        clearGameCountdown(io, currentRoom.id, 'user-disconnected');

        if (!result.roomRemoved) {
          socket.to(currentRoom.id).emit('leaveUser', {
            users: result.updatedUsers,
            newManager: result.newManager
          });
        }

        const rooms = await roomService.getWaitingRooms();
        io.emit('roomList', rooms);
      }

      await userService.disconnectUser(socket.id);

      console.log(`[Socket] 연결 해제 처리 완료: ${socket.id}`);
    } catch (error) {
      console.error('[disconnect Error]', error);
    }
  });
};
