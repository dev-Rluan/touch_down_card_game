const io = require('socket.io')(server);
const handleJoinRoom = require('./handlers/joinRoomHandler');
const handleLeaveRoom = require('./handlers/leaveRoomHandler');
const handleStartGame = require('./handlers/startGameHandler');
const handlePlayCard = require('./handlers/playCardHandler');
const handleEndGame = require('./handlers/endGameHandler');

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('joinRoom', (data) => handleJoinRoom(socket, data));
  socket.on('leaveRoom', (data) => handleLeaveRoom(socket, data));
  socket.on('startGame', (data) => handleStartGame(socket, data));
  socket.on('playCard', (data) => handlePlayCard(socket, data));
  socket.on('endGame', (data) => handleEndGame(socket, data));

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});
