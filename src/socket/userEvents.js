/**
 * 사용자 관련 Socket.IO 이벤트 핸들러
 */
const userService = require('../services/userServices');
const roomService = require('../services/roomService');
const { clearGameCountdown } = require('../utils/gameCountdown');
const { limiters, cleanupSocket } = require('../utils/socketRateLimiter');
const { withRoomLock } = require('../utils/roomLock');
const { toPublicUser } = require('../utils/roomSerializer');
const { scheduleLobbyBroadcast } = require('./lobbyBroadcast');
const { syncAfterPlayerLeft } = require('./gameSync');

const MAX_NICKNAME_LENGTH = 20;

/**
 * 사용자 관련 이벤트 핸들러 등록
 * @param {Socket} socket - Socket.IO Socket Instance
 * @param {Server} io - Socket.IO Server Instance
 */
module.exports = function(socket, io) {
  // OAuth 로그인 사용자의 경우 세션에서 displayName을 가져와 기본 닉네임으로 사용
  const sessionUser = socket.request?.user;
  const defaultName = sessionUser?.displayName
    ? sessionUser.displayName
    : `User_${socket.id.substring(0, 8)}`;

  // 로비에 있는 클라이언트만 방 목록 업데이트를 받도록 로비 룸에 참가
  socket.join('lobby');

  (async () => {
    try {
      await userService.connectUser(socket.id, defaultName);
      const waitingRooms = await roomService.getWaitingRoomSummaries();
      socket.emit('connecting', {
        nickname: defaultName,
        roomList: waitingRooms,
        // 로그인 사용자면 계정 정보도 함께 전달
        account: sessionUser
          ? {
              id: sessionUser.id,
              provider: sessionUser.provider,
              displayName: sessionUser.displayName,
              avatar: sessionUser.avatar || '',
            }
          : null,
      });
    } catch (error) {
      console.error('[connection init Error]', error);
      socket.emit('connecting', {
        nickname: defaultName,
        roomList: [],
        account: null,
        error: '서버 오류가 발생했습니다.'
      });
    }
  })();
  console.log(`[Socket] 새로운 클라이언트 연결: ${socket.id} (계정: ${sessionUser?.id || '게스트'})`);

  /**
   * 닉네임 변경 이벤트
   */
  socket.on('change name', async (newName) => {
    if (!limiters.changeName.allow(socket.id)) {
      socket.emit('name change error', '요청이 너무 빠릅니다. 잠시 후 다시 시도하세요.');
      return;
    }
    try {
      const name = typeof newName === 'string' ? newName.trim() : '';
      if (!name) {
        socket.emit('name change error', '닉네임을 입력해주세요.');
        return;
      }
      if (name.length > MAX_NICKNAME_LENGTH) {
        socket.emit('name change error', `닉네임은 ${MAX_NICKNAME_LENGTH}자 이하로 입력해주세요.`);
        return;
      }

      await userService.updateUserName(socket.id, name);
      socket.emit('name change successful', name);
      console.log(`[User] ${socket.id} 닉네임 변경: ${name}`);
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
    cleanupSocket(socket.id);
    try {
      console.log(`[Socket] 클라이언트 연결 해제: ${socket.id}`);

      const roomId = await userService.getUserRoom(socket.id);
      if (roomId) {
        const result = await withRoomLock(roomId, async () => {
          const leaveResult = await roomService.leaveRoom(socket.id, roomId);
          // 게임 도중 이탈 시 남은 플레이어의 턴/종료 상태 갱신
          await syncAfterPlayerLeft(io, leaveResult);
          return leaveResult;
        });
        clearGameCountdown(io, roomId, 'user-disconnected');

        if (!result.roomRemoved) {
          socket.to(roomId).emit('leaveUser', {
            users: result.updatedUsers.map(toPublicUser),
            newManager: result.newManager ? toPublicUser(result.newManager) : null
          });
        }
        scheduleLobbyBroadcast(io);
      }

      await userService.disconnectUser(socket.id);

      console.log(`[Socket] 연결 해제 처리 완료: ${socket.id}`);
    } catch (error) {
      console.error('[disconnect Error]', error);
    }
  });
};
