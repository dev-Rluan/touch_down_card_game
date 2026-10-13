/**
 * 로비에 있는 사람들에게 최신 방 목록을 보낸다.
 * 게임이 시작되면 방이 목록에서 빠지고, 끝나면 다시 들어가야 하는데 그때 방송하지 않으면
 * 로비 화면에 이미 시작된 방이 남거나 끝난 방이 보이지 않는다.
 */
const roomService = require('../services/roomService');
const { toPublicRooms } = require('../utils/publicView');

async function broadcastLobby(io) {
  const rooms = await roomService.getWaitingRooms();
  io.to('lobby').emit('roomList', toPublicRooms(rooms));
}

module.exports = { broadcastLobby };
