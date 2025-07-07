// /services/roomService.js
const { v4: uuidv4 } = require('uuid');
const userService = require('./userServices');

// 방 목록 예시: [{ id, name, users, status, maxUserCnt, etc. }]
const roomList = [];
const rooms = new Map();

function createRoom(socketId, roomName, maxCnt) {
  // 중복 이름 체크
  const existing = roomList.find(r => r.name === roomName);
  if (existing) {
    throw new Error("이미 같은 이름의 방이 존재합니다.");
  }

  // roomId 생성
  const roomId = _createRoomId();
  const userName = userService.getUserName(socketId);

  const newRoom = {
    id: roomId,
    name: roomName,
    users: [{
      id: socketId,
      name: userName,
      readyStatus: 'waiting',
      score: 0,
      order: 0,
      manager: true,
      cardPack: []
    }],
    status: 'waiting',
    maxUserCnt: maxCnt || 4,
    upCardList: [],
    turn: 0
  };
  roomList.push(newRoom);

  // 연결된 유저에 roomId 등록
  userService.setUserRoom(socketId, roomId);

  return newRoom;
}

function joinRoom(socketId, roomId) {
  const room = roomList.find(r => r.id === roomId);
  if (!room) throw new Error("존재하지 않는 방입니다.");

  if (room.users.length >= room.maxUserCnt) {
    throw new Error("방 인원이 가득 찼습니다.");
  }
  if (room.status !== 'waiting') {
    throw new Error("이 방은 입장할 수 없는 상태입니다.");
  }

  const userName = userService.getUserName(socketId);

  const user = {
    id: socketId,
    name: userName,
    readyStatus: 'waiting',
    score: 0,
    order: 0,
    manager: false,
    cardPack: []
  };
  room.users.push(user);

  userService.setUserRoom(socketId, roomId);
  return room;
}

function leaveRoom(socketId, roomId) {
  const idx = roomList.findIndex(r => r.id === roomId);
  if (idx < 0) throw new Error("해당 방이 존재하지 않습니다.");
  
  const room = roomList[idx];
  room.users = room.users.filter(u => u.id !== socketId);

  userService.setUserRoom(socketId, ''); // 유저 roomId 해제

  // 방 유저가 0이면 방 삭제
  if (room.users.length === 0) {
    roomList.splice(idx, 1);
    return { updatedUsers: [], roomRemoved: true };
  }

  // 방장 유저가 없으면 첫 번째 유저를 방장으로
  const hasManager = room.users.some(u => u.manager === true);
  if (!hasManager && room.users.length > 0) {
    room.users[0].manager = true;
  }
  
  return {
    updatedUsers: room.users,
    roomRemoved: false
  };
}

function getWaitingRooms() {
  return roomList.filter(r => r.status === 'waiting');
}

// 내부적으로 방 ID 생성
function _createRoomId() {
  let unique = false;
  let roomId = "";
  while (!unique) {
    roomId = uuidv4();
    if (!roomList.find(r => r.id === roomId)) {
      unique = true;
    }
  }
  return roomId;
}

function findRoom(roomId) {
  return roomList.find(r => r.id === roomId);
}

module.exports = {
  createRoom,
  joinRoom,
  leaveRoom,
  getWaitingRooms,
  findRoom,
};