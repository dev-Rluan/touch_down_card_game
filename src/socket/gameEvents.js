/**
 * 게임 관련 Socket.IO 이벤트 핸들러
 */
const roomService = require('../services/roomService');
const gameService = require('../services/gameService');
const userService = require('../services/userServices');
const { clearGameCountdown, startGameCountdown } = require('../utils/gameCountdown');
const { limiters } = require('../utils/socketRateLimiter');
const { withRoomLock } = require('../utils/roomLock');
const { toPublicUsers } = require('../utils/publicView');
const rankingService = require('../services/rankingService');
const achievementService = require('../services/achievementService');
const dailyMissionService = require('../services/dailyMissionService');

/**
 * 소켓 유저가 속한 방을 방 락 안에서 **한 번만** 읽어 fn 에 넘긴다.
 *  - 방 ID 조회(HGET) 1회 + 방 읽기(GET) 1회. 이후 서비스 함수들은 이 객체를 재사용하므로
 *    같은 방을 여러 번 읽지 않는다 (Redis 가 멀리 있을수록 왕복 횟수가 곧 지연이다).
 *  - 락 덕분에 읽기~저장 사이에 같은 방의 다른 요청이 끼어들지 않는다.
 */
async function withUserRoom(socket, errorEvent, fn) {
  const roomId = await userService.getUserRoom(socket.id);
  if (!roomId) {
    socket.emit(errorEvent, '참여 중인 방이 없습니다.');
    return;
  }
  await withRoomLock(roomId, async () => {
    const room = await roomService.getRoomById(roomId);
    if (!room) {
      socket.emit(errorEvent, '참여 중인 방이 없습니다.');
      return;
    }
    await fn(room);
  });
}

/**
 * 게임 관련 이벤트 핸들러 등록
 * @param {Socket} socket - Socket.IO Socket Instance
 * @param {Server} io - Socket.IO Server Instance
 */
module.exports = function(socket, io) {
  /**
   * 준비 상태 변경 이벤트
   */
  socket.on('ready', async () => {
    if (!limiters.ready.allow(socket.id)) {
      socket.emit('readyError', '요청이 너무 빠릅니다. 잠시 후 다시 시도하세요.');
      return;
    }
    try {
      await withUserRoom(socket, 'readyError', async (currentRoom) => {
        // 게임 중에는 준비 상태를 바꿀 수 없다 (게임 중 ready 로 상태가 꼬이거나 다른 이벤트를 유발하는 것을 막는다)
        if (currentRoom.status !== 'waiting') {
          socket.emit('readyError', '게임이 진행 중입니다.');
          return;
        }

        const user = currentRoom.users.find(u => u.id === socket.id);
        if (!user) {
          socket.emit('readyError', '사용자를 찾을 수 없습니다.');
          return;
        }

        user.readyStatus = user.readyStatus === 'ready' ? 'waiting' : 'ready';
        await roomService.saveRoomState(currentRoom, { reindex: false });
        io.to(currentRoom.id).emit('updateReadyStatus', toPublicUsers(currentRoom.users));

        const allReady = currentRoom.users.every(u => u.readyStatus === 'ready');
        if (allReady && currentRoom.users.length >= 2) {
          io.to(currentRoom.id).emit('allReady', toPublicUsers(currentRoom.users));
          await startGameCountdown(io, currentRoom.id);
        } else {
          clearGameCountdown(io, currentRoom.id, 'not-all-ready');
        }

        console.log(`[Game] 준비 상태 변경 - 사용자: ${user.name}, 상태: ${user.readyStatus}`);
      });
    } catch (error) {
      console.error('[ready Error]', error);
      socket.emit('readyError', error.message);
    }
  });

  /**
   * 게임 상태 조회 이벤트
   */
  socket.on('getGameState', async () => {
    try {
      const currentRoom = await roomService.getRoomByUser(socket.id);
      if (!currentRoom) {
        socket.emit('gameStateError', '참여 중인 방이 없습니다.');
        return;
      }

      const gameState = await gameService.getGameState(currentRoom.id);
      socket.emit('gameState', gameState);
    } catch (error) {
      console.error('[getGameState Error]', error);
      socket.emit('gameStateError', error.message);
    }
  });

  /**
   * 카드 내기 이벤트
   */
  socket.on('playCard', async (cardIndex) => {
    if (!limiters.playCard.allow(socket.id)) {
      socket.emit('playCardError', '요청이 너무 빠릅니다. 잠시 후 다시 시도하세요.');
      return;
    }
    try {
      await withUserRoom(socket, 'playCardError', async (room) => {
        // 읽어 둔 room 을 서비스에 넘겨 재사용한다 (저장도 여기서 1회)
        const result = await gameService.playCard(room.id, socket.id, cardIndex, room);
        const playerName = room.users.find(u => u.id === socket.id)?.name || null;
        io.to(room.id).emit('cardPlayed', {
          playerId: socket.id,
          playerName,
          result
        });

        // playCard 가 room 을 변경·저장했으므로 같은 객체의 손패가 최신 상태다
        room.users.forEach(u => {
          try {
            io.to(u.id).emit('yourHand', { cards: u.cardPack || [] });
          } catch (e) {
            console.error('[yourHand update Error]', e);
          }
        });

        const gameEndResult = await gameService.checkGameEnd(room.id, room);
        if (gameEndResult.isEnded) {
          io.to(room.id).emit('gameEnd', gameEndResult);
          // 리텐션 훅: 게임 종료 시 랭킹/업적/미션 비동기 갱신
          setImmediate(() => handleGameEndRetention(io, room, gameEndResult));
        }

        console.log(`[Game] 카드 내기 - 플레이어: ${playerName}, 카드 인덱스: ${cardIndex}`);
      });
    } catch (error) {
      console.error('[playCard Error]', error);
      socket.emit('playCardError', error.message);
    }
  });

  /**
   * 할리갈리 이벤트
   */
  socket.on('halliGalli', async () => {
    if (!limiters.halliGalli.allow(socket.id)) {
      socket.emit('halliGalliError', '요청이 너무 빠릅니다. 잠시 후 다시 시도하세요.');
      return;
    }
    try {
      await withUserRoom(socket, 'halliGalliError', async (room) => {
        const result = await gameService.handleHalliGalli(room.id, socket.id, room);
        const playerName = result.playerName
          || room.users.find(u => u.id === socket.id)?.name
          || null;
        io.to(room.id).emit('halliGalliResult', {
          playerId: socket.id,
          playerName,
          success: result.success,
          scoreGained: result.scoreGained || 0,
          centerCardsGained: result.centerCardsGained || 0,
          discardedCardsGained: result.discardedCardsGained || 0,
          newScore: result.newScore || 0,
          centerCards: result.centerCards,
          // 버림 더미는 뒤집어 놓은 카드이므로 내용(과일/개수)은 보내지 않고 장수만 보낸다
          discardedCount: (result.discardedCards || []).length
        });

        // 결과 직후 최신 게임 상태를 같은 락 안에서 전송한다.
        // (예전에는 100ms 뒤에 방을 다시 읽었는데, 그 사이 다음 카드가 나오면 오래된 상태가 덮어쓸 수 있었다)
        try {
          io.to(room.id).emit('gameState', gameService.buildGameState(room));
        } catch (err) {
          console.error('[gameState emit Error]', err);
        }

        // 벨 성공 시 bellRings 업적/미션 갱신 (비동기)
        if (result.success) {
          setImmediate(() => recordBellSuccess(io, socket.id));
        }
        console.log(`[Game] 할리갈리 - 플레이어: ${playerName}, 성공: ${result.success}`);
      });
    } catch (error) {
      console.error('[halliGalli Error]', error);
      socket.emit('halliGalliError', error.message);
    }
  });
};

// ── 리텐션 훅: 게임 종료 후 처리 ────────────────────────────────────────────
/**
 * 게임 종료 시 각 플레이어의 랭킹/업적/미션을 비동기로 갱신하고
 * 새로 달성된 업적과 완료된 미션을 해당 플레이어 소켓으로 전송한다.
 *
 * @param {Server} io
 * @param {Object} room       - 최신 room 객체 (users 포함)
 * @param {Object} gameEndResult - checkGameEnd 반환값
 */
async function handleGameEndRetention(io, room, gameEndResult) {
  if (!room || !room.users) return;

  const winnerId = gameEndResult.winner?.id;

  for (const user of room.users) {
    try {
      // socket.request.user 가 없을 수 있으므로 소켓을 통해 세션 유저 조회
      const socketObj = io.sockets.sockets.get(user.id);
      const accountId = socketObj?.request?.user?.id || null;
      if (!accountId) continue; // 게스트 → 스킵

      const isWinner = user.id === winnerId;
      const scoreGained = gameEndResult.finalScores?.find(s => s.id === user.id)?.score || 0;
      const displayName = socketObj.request.user.displayName || user.name;
      const avatar = socketObj.request.user.avatar || '';

      // 1) 랭킹 갱신
      await rankingService.recordResult(accountId, displayName, avatar, isWinner, scoreGained);

      // 2) 업적 체크
      const statsDelta = {
        totalGames: 1,
        totalWins: isWinner ? 1 : 0,
        totalScore: scoreGained,
        bellRings: 0, // 벨 성공은 halliGalli 이벤트에서 별도 증가
      };
      const newAchievements = await achievementService.updateAndCheck(accountId, statsDelta);

      // 3) 일일 미션 체크
      const missionDelta = {
        gamesPlayed: 1,
        wins: isWinner ? 1 : 0,
        scoreEarned: scoreGained,
        bellSuccess: 0,
      };
      const newMissions = await dailyMissionService.updateAndCheck(accountId, missionDelta);

      // 4) 클라이언트에 알림 발송
      if (newAchievements.length > 0) {
        socketObj.emit('achievementsUnlocked', newAchievements);
      }
      if (newMissions.length > 0) {
        socketObj.emit('missionsCompleted', newMissions);
      }
    } catch (err) {
      console.error('[retention hook Error]', err.message);
    }
  }
}

// 벨 성공 시 bellRings 통계 갱신 (halliGalli 이벤트에서 외부 호출)
async function recordBellSuccess(io, socketId) {
  try {
    const socketObj = io.sockets.sockets.get(socketId);
    const accountId = socketObj?.request?.user?.id || null;
    if (!accountId) return;

    const [newAchievements, newMissions] = await Promise.all([
      achievementService.updateAndCheck(accountId, { bellRings: 1 }),
      dailyMissionService.updateAndCheck(accountId, { bellSuccess: 1 }),
    ]);

    if (newAchievements.length > 0) socketObj.emit('achievementsUnlocked', newAchievements);
    if (newMissions.length > 0) socketObj.emit('missionsCompleted', newMissions);
  } catch (err) {
    console.error('[recordBellSuccess Error]', err.message);
  }
}

module.exports.handleGameEndRetention = handleGameEndRetention;
module.exports.recordBellSuccess = recordBellSuccess;
