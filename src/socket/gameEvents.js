/**
 * 게임 관련 Socket.IO 이벤트 핸들러
 */
const roomService = require('../services/roomService');
const gameService = require('../services/gameService');
const userService = require('../services/userServices');
const { clearGameCountdown, startGameCountdown } = require('../utils/gameCountdown');

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
    try {
      const currentRoom = await roomService.getRoomByUser(socket.id);
      if (!currentRoom) {
        socket.emit('readyError', '참여 중인 방이 없습니다.');
        return;
      }

      const user = currentRoom.users.find(u => u.id === socket.id);
      if (!user) {
        socket.emit('readyError', '사용자를 찾을 수 없습니다.');
        return;
      }

      user.readyStatus = user.readyStatus === 'ready' ? 'waiting' : 'ready';
      await roomService.saveRoomState(currentRoom);
      io.to(currentRoom.id).emit('updateReadyStatus', currentRoom.users);

      const allReady = currentRoom.users.every(u => u.readyStatus === 'ready');
      if (allReady && currentRoom.users.length >= 2) {
        io.to(currentRoom.id).emit('allReady', currentRoom.users);
        await startGameCountdown(io, currentRoom.id);
      } else {
        clearGameCountdown(io, currentRoom.id, 'not-all-ready');
      }

      console.log(`[Game] 준비 상태 변경 - 사용자: ${user.name}, 상태: ${user.readyStatus}`);
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
    try {
      const currentRoom = await roomService.getRoomByUser(socket.id);
      if (!currentRoom) {
        socket.emit('playCardError', '참여 중인 방이 없습니다.');
        return;
      }

      const result = await gameService.playCard(currentRoom.id, socket.id, cardIndex);
      const playerName = await userService.getUserName(socket.id);
      io.to(currentRoom.id).emit('cardPlayed', {
        playerId: socket.id,
        playerName,
        result
      });

      const latestRoom = await roomService.getRoomById(currentRoom.id);
      if (latestRoom && Array.isArray(latestRoom.users)) {
        latestRoom.users.forEach(u => {
          try {
            io.to(u.id).emit('yourHand', { cards: u.cardPack || [] });
          } catch (e) {
            console.error('[yourHand update Error]', e);
          }
        });
      }

      const gameEndResult = await gameService.checkGameEnd(currentRoom.id);
      if (gameEndResult.isEnded) {
        io.to(currentRoom.id).emit('gameEnd', gameEndResult);
      }

      console.log(`[Game] 카드 내기 - 플레이어: ${playerName}, 카드 인덱스: ${cardIndex}`);
    } catch (error) {
      console.error('[playCard Error]', error);
      socket.emit('playCardError', error.message);
    }
  });

  /**
   * 할리갈리 이벤트
   */
  socket.on('halliGalli', async () => {
    try {
      const currentRoom = await roomService.getRoomByUser(socket.id);
      if (!currentRoom) {
        socket.emit('halliGalliError', '참여 중인 방이 없습니다.');
        return;
      }

      const result = await gameService.handleHalliGalli(currentRoom.id, socket.id);
      const playerName = await userService.getUserName(socket.id);
      io.to(currentRoom.id).emit('halliGalliResult', {
        playerId: socket.id,
        playerName,
        success: result.success,
        scoreGained: result.scoreGained || 0,
        centerCardsGained: result.centerCardsGained || 0,
        discardedCardsGained: result.discardedCardsGained || 0,
        newScore: result.newScore || 0,
        discardedCard: result.discardedCard,
        centerCards: result.centerCards,
        discardedCards: result.discardedCards
      });

      setTimeout(async () => {
        try {
          const gameState = await gameService.getGameState(currentRoom.id);
          io.to(currentRoom.id).emit('gameState', gameState);
        } catch (err) {
          console.error('[gameState emit Error]', err);
        }
      }, 100);

      console.log(`[Game] 할리갈리 - 플레이어: ${playerName}, 성공: ${result.success}`);
    } catch (error) {
      console.error('[halliGalli Error]', error);
      socket.emit('halliGalliError', error.message);
    }
  });
};
