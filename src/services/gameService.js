const { getRoomById } = require('./roomService');
const { shuffleCards } = require('../utils/cardUtils');

const startGame = (roomId) => {
  const room = getRoomById(roomId);
  if (!room) throw new Error('Room not found.');

  room.cards = shuffleCards();
  room.state = 'playing';
  // Initialize other game states if needed (e.g., turn order)
};

const getGameState = (roomId) => {
  const room = getRoomById(roomId);
  if (!room) throw new Error('Room not found.');
  return { players: room.players, cardsLeft: room.cards.length, state: room.state };
};

module.exports = { startGame, getGameState };
