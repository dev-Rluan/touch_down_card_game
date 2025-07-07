// /socket/gameEvents.js
const gameController = require('../controllers/gameController');

module.exports = (socket, io) => {
  socket.on("ready", (data) => {
    gameController.ready(socket, data);
  });

  socket.on("startGame", () => {
    gameController.startGame(socket, io);
  });

  socket.on("playTurn", () => {
    gameController.playTurn(socket, io);
  });

  socket.on("ringBell", () => {
    gameController.ringBell(socket, io);
  });

  socket.on("endGame", () => {
    gameController.endGame(socket, io);
  });
};