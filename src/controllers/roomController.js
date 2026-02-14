// /controllers/roomController.js

const roomService = require('../services/roomService');

module.exports = {
  // 방 생성
  createRoom: async (socket, io, roomName, maxCnt) => {
    try {
      const room = await roomService.createRoom(socket.id, roomName, maxCnt);
      socket.join(room.id);
      socket.emit('roomCreated', room);
      const rooms = await roomService.getWaitingRooms();
      io.emit('roomList', rooms);
    } catch (error) {
      console.error("[createRoom Error]", error);
      socket.emit('createRoomError', error.message);
    }
  },

  // 방 목록
  getRoomList: async (socket) => {
    const rooms = await roomService.getWaitingRooms();
    socket.emit('roomList', rooms);
  },

  // 방 입장
  joinRoom: async (socket, io, roomId) => {
    try {
      const room = await roomService.joinRoom(socket.id, roomId);
      socket.join(roomId);
      socket.emit('successJoinRoom', room);
      socket.to(roomId).emit('joinUser', room.users, room.maxUserCnt);
    } catch (error) {
      console.error("[joinRoom Error]", error);
      socket.emit('faildJoinRoom', error.message);
    }
  },

  // 방 나가기
  leaveRoom: async (socket, io, roomId) => {
    try {
      const { updatedUsers, roomRemoved } = await roomService.leaveRoom(socket.id, roomId);
      socket.leave(roomId);

      socket.emit("leaveRoomResult", { status: 200, message: "successLeaveRoom" });

      if (!roomRemoved) {
        socket.to(roomId).emit('leaveUser', updatedUsers);
      }

      const rooms = await roomService.getWaitingRooms();
      io.emit('roomList', rooms);
    } catch (error) {
      console.error("[leaveRoom Error]", error);
      socket.emit("leaveRoomResult", { status: 400, message: error.message });
    }
  },
};
