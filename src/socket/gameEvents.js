// /socket/gameEvents.js
const gameController = require('../controllers/gameController');

module.exports = (socket, io) => {
  socket.on("ready", (data) => {
    gameController.ready(socket, io, data);
  });

  socket.on("startGame", (data) => {
    gameController.startGame(socket, io, data);
  });

  socket.on("playTurn", (data) => {
    gameController.playTurn(socket, io, data);
  });

  socket.on("ringBell", (data) => {
    gameController.ringBell(socket, io, data);
  });

  socket.on("endGame", (data) => {
    gameController.endGame(socket, io, data);
  });
};