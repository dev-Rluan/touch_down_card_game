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
const { broadcastLobby } = require('./lobbyBroadcast');
const bellOrder = require('../utils/bellOrder');
const latency = require('../utils/latency');
const bellTiming = require('../utils/bellTiming');
const rankingService = require('../services/rankingService');
const achievementService = require('../services/achievementService');
const dailyMissionService = require('../services/dailyMissionService');

/**
 * 방의 모든 플레이어에게 각자의 남은 카드 장수를 보낸다 (본인에게만 전달 — io.to(socketId)).
 * 카드 내용은 보내지 않는다: 자기 덱의 다음 카드를 미리 알면 그 카드가 5를 만드는 순간 벨을 바로 누를 수 있다.
 * 카드 수가 바뀌는 모든 동작(카드 내기, 벨 성공/실패) 뒤에 호출해 화면의 "내 덱 N장"을 최신으로 유지한다.
 */
function emitHands(io, room) {
  room.users.forEach(u => {
    try {
      io.to(u.id).emit('yourHand', { count: (u.cardPack || []).length });
    } catch (e) {
      console.error('[yourHand update Error]', e);
    }
  });
}

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
    if (!limiters.getGameState.allow(socket.id)) return;
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
        // 바닥이 바뀌었으므로 이후의 벨은 새 라운드로 센다
        bellOrder.clearRound(room.id);
        const playerName = room.users.find(u => u.id === socket.id)?.name || null;
        io.to(room.id).emit('cardPlayed', {
          playerId: socket.id,
          playerName,
          // 공개용 결과만 보낸다: 벨 정답(isHalliGalli)을 보내면 개발자도구로 "지금 치면 성공"을 알 수 있고,
          // 중앙 카드 전체 목록은 가려진 카드까지 드러내며 판마다 계속 커진다
          result: {
            playedCard: result.playedCard,
            nextTurn: result.nextTurn,
            playerCardCount: result.playerCardCount,
            centerCount: (result.centerCards || []).length,
            boardSeq: result.boardSeq,
          }
        });

        // playCard 가 room 을 변경·저장했으므로 같은 객체의 손패가 최신 상태다
        emitHands(io, room);

        const gameEndResult = await gameService.checkGameEnd(room.id, room);
        if (gameEndResult.isEnded) {
          bellOrder.clearRound(room.id);
          io.to(room.id).emit('gameEnd', gameEndResult);
          // 리텐션 훅: 게임 종료 시 랭킹/업적/미션 비동기 갱신
          setImmediate(() => handleGameEndRetention(io, room, gameEndResult));
          // 끝난 방은 다시 대기 상태 → 로비 목록에 다시 보이도록
          await broadcastLobby(io);
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
   * payload(선택): { pressedAt: 누른 순간의 서버 시계 기준 시각, boardSeq: 누를 때 보던 바닥 번호 }
   * 바로 판정하지 않고 방별로 잠깐 모았다가 네트워크 지연을 보정한 시각 순으로 판정한다 (utils/bellTiming).
   */
  socket.on('halliGalli', async (payload) => {
    // 보정의 기준: 서버가 이벤트를 받은 시각 (Redis 조회 등 await 전에 잰다)
    const arrivedAt = Date.now();
    if (!limiters.halliGalli.allow(socket.id)) {
      socket.emit('halliGalliError', '벨은 1초에 한 번만 누를 수 있습니다.');
      return;
    }
    try {
      const roomId = await userService.getUserRoom(socket.id);
      if (!roomId) {
        socket.emit('halliGalliError', '참여 중인 방이 없습니다.');
        return;
      }
      const ping = latency.getLatency(socket.id)?.rtt ?? null;
      const { effective, compensation } = bellTiming.effectiveTime(arrivedAt, payload?.pressedAt, ping);
      const press = {
        socket, playerId: socket.id, arrivedAt, effective, compensation, ping,
        boardSeq: Number.isInteger(payload?.boardSeq) ? payload.boardSeq : null,
      };
      // 방 안 소켓(관전자 포함)의 최대 보정만큼만 기다린다
      const roomSockets = io.sockets?.adapter?.rooms?.get(roomId) || [];
      const roomMaxComp = Math.max(0, ...[...roomSockets].map(id => bellTiming.compensationFor(latency.getLatency(id)?.rtt)));
      press.wait = bellTiming.waitFor(press, roomMaxComp);
      await bellTiming.enqueue(roomId, press, presses => judgeBells(io, roomId, presses));
    } catch (error) {
      console.error('[halliGalli Error]', error);
      socket.emit('halliGalliError', error.message);
    }
  });
};

// ── 벨 판정 (보정시각 순으로 모인 누름들) ─────────────────────────────────────
/**
 * 한 묶음의 누름을 보정시각 순으로 하나씩 판정한다. 방 락 안에서 방을 한 번 읽어 재사용한다.
 * 앞사람이 성공해 바닥이 비면 뒷사람은 벌칙 없이 "늦었음", 앞사람이 실패하면 뒷사람도 같은 바닥으로 판정.
 */
async function judgeBells(io, roomId, presses) {
  await withRoomLock(roomId, async () => {
    const room = await roomService.getRoomById(roomId);
    // 지금 바닥을 보고 누른 벨은 "카드가 그 사람에게 도착한 시각"보다 앞설 수 없다 → 하한 적용 후 다시 정렬
    if (room?.gameState) {
      presses.forEach(p => {
        if (!bellTiming.shouldUsePrevBoard(p, room.gameState)) {
          p.effective = Math.max(p.effective, Math.min(p.arrivedAt, bellTiming.currentBoardFloor(p, room.gameState)));
        }
      });
      presses.sort((a, b) => a.effective - b.effective || a.arrivedAt - b.arrivedAt);

      // 카드가 나온 뒤 사람이 반응할 수 없을 만큼 빠른 누름은 기록해 둔다 (판정은 바꾸지 않음, /admin/latency 에서 확인)
      if ((room.gameState.centerCards || []).length > 0) {
        presses.forEach(p => {
          if (bellTiming.shouldUsePrevBoard(p, room.gameState)) return;
          const name = room.users.find(u => u.id === p.playerId)?.name || null;
          const reaction = bellTiming.noteReaction(p, name, room.gameState);
          if (reaction !== null && reaction < bellTiming.SUSPICIOUS_REACTION_MS) {
            console.warn(`[Bell] 비정상적으로 빠른 반응 - ${name}: ${Math.round(reaction)}ms (핑 ${p.ping ?? '-'}ms)`);
          }
        });
      }
    }
    for (const press of presses) {
      const { socket } = press;
      try {
        if (!room || !room.gameState) {
          socket.emit('halliGalliError', '게임이 시작되지 않았습니다.');
          continue;
        }
        if (room.gameState.phase !== 'playing') {
          socket.emit('halliGalliError', '게임이 진행 중이 아닙니다.');
          continue;
        }
        const presser = room.users.find(u => u.id === press.playerId);
        if (!presser) {
          socket.emit('halliGalliError', '참여 중인 방이 없습니다.');
          continue;
        }

        // 카드가 남은 플레이어의 누름만 순서에 넣는다 (탈락자·빈 바닥은 제외)
        const order = presser.cardPack?.length > 0
          ? bellOrder.recordPress(room.id, presser, press.effective, {
            canStart: (room.gameState.centerCards || []).length > 0,
            ping: press.ping,
          })
          : null;
        if (order) {
          io.to(room.id).emit('bellOrder', { round: order.round, presses: order.presses });
          if (order.rank > 1 && (room.gameState.centerCards || []).length === 0) {
            socket.emit('halliGalliError', '한 발 늦었어요!');
            continue;
          }
        }

        const usePrevBoard = bellTiming.shouldUsePrevBoard(press, room.gameState);
        const result = await gameService.handleHalliGalli(room.id, press.playerId, room, { usePrevBoard });
        io.to(room.id).emit('halliGalliResult', {
          playerId: press.playerId,
          playerName: result.playerName || presser.name || null,
          success: result.success,
          scoreGained: result.scoreGained || 0,
          centerCardsGained: result.centerCardsGained || 0,
          discardedCardsGained: result.discardedCardsGained || 0,
          newScore: result.newScore || 0,
          centerCount: (result.centerCards || []).length,
          // 버림 더미는 뒤집어 놓은 카드이므로 내용(과일/개수)은 보내지 않고 장수만 보낸다
          discardedCount: (result.discardedCards || []).length,
          boardSeq: result.boardSeq,
          // 새 카드가 깔리기 직전 바닥을 보고 누른 것으로 인정된 판정
          judgedOnPrev: Boolean(result.judgedOnPrev),
        });

        // 결과 직후 최신 게임 상태를 같은 락 안에서 전송한다
        try {
          io.to(room.id).emit('gameState', gameService.buildGameState(room));
        } catch (err) {
          console.error('[gameState emit Error]', err);
        }

        // 벨 성공(카드 획득)/실패(카드 1장 버림) 모두 손패가 바뀌므로 각자의 손패를 다시 보낸다
        emitHands(io, room);

        // 벨 실패로 마지막 카드를 잃어 카드가 있는 사람이 1명 이하가 되면 바로 게임을 끝낸다
        const gameEndResult = await gameService.checkGameEnd(room.id, room);
        if (gameEndResult.isEnded) {
          bellOrder.clearRound(room.id);
          io.to(room.id).emit('gameEnd', gameEndResult);
          setImmediate(() => handleGameEndRetention(io, room, gameEndResult));
          await broadcastLobby(io);
        }

        if (result.success) {
          setImmediate(() => recordBellSuccess(io, press.playerId));
        }
        console.log(`[Game] 할리갈리 - 플레이어: ${presser.name}, 성공: ${result.success}, 보정 ${press.compensation}ms${result.judgedOnPrev ? ', 직전 바닥 판정' : ''}`);
      } catch (error) {
        socket.emit('halliGalliError', error.message);
      }
    }
  });
}

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
