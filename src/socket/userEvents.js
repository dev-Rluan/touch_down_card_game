/**
 * 사용자 관련 Socket.IO 이벤트 핸들러
 */
const userService = require('../services/userServices');
const roomService = require('../services/roomService');

/**
 * 사용자 관련 이벤트 핸들러 등록
 * @param {Socket} socket - Socket.IO Socket Instance
 * @param {Server} io - Socket.IO Server Instance
 */
module.exports = function(socket, io) {
  // 사용자 연결 처리 (초기 데이터 전송)
  const defaultName = `User_${socket.id.substring(0, 8)}`;
  userService.connectUser(socket.id, defaultName);
  
  // 연결 성공 응답
  const initialData = {
    nickname: defaultName,
    roomList: roomService.getWaitingRooms()
  };
  socket.emit('connecting', initialData);
  console.log(`[Socket] 새로운 클라이언트 연결: ${socket.id}`);

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
};

