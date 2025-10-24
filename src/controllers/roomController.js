// /controllers/roomController.js

const roomService = require('../services/roomService');
const userService = require('../services/userService'); // 유저 정보(connectedClients) 관리

module.exports = {
  // 방 생성
  createRoom: (socket, io, roomName, maxCnt) => {
    try {
      const room = roomService.createRoom(socket.id, roomName, maxCnt);
      // 소켓 join
      socket.join(room.id);
      // 본인에게 방 생성 성공 알림
      socket.emit('roomCreated', room);
      // 전체에게 대기중 방 목록 갱신
      io.emit('roomList', roomService.getWaitingRooms());
    } catch (error) {
      console.error("[createRoom Error]", error);
      socket.emit('createRoomError', error.message);
    }
  },

  // 방 목록
  getRoomList: (socket) => {
    const rooms = roomService.getWaitingRooms();
    socket.emit('roomList', rooms);
  },

  // 방 입장
  joinRoom: (socket, io, roomId) => {
    try {
      const room = roomService.joinRoom(socket.id, roomId);
      socket.join(roomId);
      // 본인에게 성공 알림
      socket.emit('successJoinRoom', room);
      // 같은 방에 유저들에게 알림
      socket.to(roomId).emit('joinUser', room.users, room.maxUserCnt);
    } catch (error) {
      console.error("[joinRoom Error]", error);
      socket.emit('faildJoinRoom', error.message);
    }
  },

  // 방 나가기
  leaveRoom: (socket, io, roomId) => {
    try {
      const { updatedUsers, roomRemoved } = roomService.leaveRoom(socket.id, roomId);
      socket.leave(roomId);

      socket.emit("leaveRoomResult", { status: 200, message: "successLeaveRoom" });

      // 방이 삭제되지 않았다면 다른 유저들에게 알림
      if (!roomRemoved) {
        socket.to(roomId).emit('leaveUser', updatedUsers);
      }

      // 대기중 방 목록 갱신
      io.emit('roomList', roomService.getWaitingRooms());
    } catch (error) {
      console.error("[leaveRoom Error]", error);
      socket.emit("leaveRoomResult", { status: 400, message: error.message });
    }
  },
};