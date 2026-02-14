// /services/roomService.js
const { v4: uuidv4 } = require('uuid');
const { ensureRedisConnection } = require('../config/redisClient');
const userService = require('./userServices');

const ROOM_DATA_PREFIX = 'room:data:';
const WAITING_ROOMS_SET = 'rooms:waiting';
const ROOM_NAME_HASH = 'rooms:name:index';

function getRoomKey(roomId) {
  return `${ROOM_DATA_PREFIX}${roomId}`;
}

async function fetchRoom(roomId) {
  if (!roomId) return null;
  const redis = await ensureRedisConnection();
  const raw = await redis.get(getRoomKey(roomId));
  return raw ? JSON.parse(raw) : null;
}

async function persistRoom(room) {
  const redis = await ensureRedisConnection();
  await redis.set(getRoomKey(room.id), JSON.stringify(room));
  await redis.hSet(ROOM_NAME_HASH, room.name, room.id);
  if (room.status === 'waiting') {
    await redis.sAdd(WAITING_ROOMS_SET, room.id);
  } else {
    await redis.sRem(WAITING_ROOMS_SET, room.id);
  }
}

async function removeRoom(room) {
  const redis = await ensureRedisConnection();
  await redis.del(getRoomKey(room.id));
  await redis.sRem(WAITING_ROOMS_SET, room.id);
  await redis.hDel(ROOM_NAME_HASH, room.name);
}

async function ensureRoomNameUnique(roomName) {
  const redis = await ensureRedisConnection();
  const existingRoomId = await redis.hGet(ROOM_NAME_HASH, roomName);
  if (existingRoomId) {
    throw new Error('이미 같은 이름의 방이 존재합니다.');
  }
}

async function createRoom(socketId, roomName, maxUserCnt) {
  if (!socketId || !roomName || !roomName.trim()) {
    throw new Error('필수 입력값이 누락되었습니다.');
  }

  if (maxUserCnt && (maxUserCnt < 2 || maxUserCnt > 8)) {
    throw new Error('최대 인원수는 2명 이상 8명 이하여야 합니다.');
  }

  const trimmedName = roomName.trim();
  await ensureRoomNameUnique(trimmedName);

  const currentRoomId = await userService.getUserRoom(socketId);
  if (currentRoomId) {
    throw new Error('이미 다른 방에 참여 중입니다.');
  }

  const userName = await userService.getUserName(socketId);
  if (!userName) {
    throw new Error('사용자 정보를 찾을 수 없습니다.');
  }

  const roomId = uuidv4();
  const newRoom = {
    id: roomId,
    name: trimmedName,
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
    maxUserCnt: maxUserCnt || 4,
    upCardList: [],
    turn: 0,
    createdAt: new Date().toISOString(),
    gameState: null
  };

  await persistRoom(newRoom);
  await userService.setUserRoom(socketId, roomId);

  return newRoom;
}

async function joinRoom(socketId, roomId) {
  if (!socketId || !roomId) {
    throw new Error('필수 입력값이 누락되었습니다.');
  }

  const room = await fetchRoom(roomId);
  if (!room) {
    throw new Error('존재하지 않는 방입니다.');
  }

  const currentRoom = await userService.getUserRoom(socketId);
  if (currentRoom) {
    throw new Error('이미 다른 방에 참여 중입니다.');
  }

  if (room.status !== 'waiting') {
    throw new Error('이 방은 입장할 수 없는 상태입니다.');
  }

  if (room.users.length >= room.maxUserCnt) {
    throw new Error('방 인원이 가득 찼습니다.');
  }

  if (room.users.find((u) => u.id === socketId)) {
    throw new Error('이미 이 방에 참여 중입니다.');
  }

  const userName = await userService.getUserName(socketId);
  if (!userName) {
    throw new Error('사용자 정보를 찾을 수 없습니다.');
  }

  const user = {
    id: socketId,
    name: userName,
    readyStatus: 'waiting',
    score: 0,
    order: room.users.length,
    manager: false,
    cardPack: []
  };

  room.users.push(user);
  await persistRoom(room);
  await userService.setUserRoom(socketId, roomId);

  return room;
}

async function leaveRoom(socketId, roomId) {
  if (!socketId || !roomId) {
    throw new Error('필수 입력값이 누락되었습니다.');
  }

  const room = await fetchRoom(roomId);
  if (!room) {
    throw new Error('해당 방이 존재하지 않습니다.');
  }

  const userIndex = room.users.findIndex((u) => u.id === socketId);
  if (userIndex < 0) {
    throw new Error('해당 방에 참여하지 않은 사용자입니다.');
  }

  const wasManager = room.users[userIndex].manager;
  room.users.splice(userIndex, 1);
  await userService.setUserRoom(socketId, '');

  if (room.users.length === 0) {
    await removeRoom(room);
    return {
      updatedUsers: [],
      roomRemoved: true,
      newManager: null
    };
  }

  let newManager = null;
  if (wasManager) {
    room.users[0].manager = true;
    newManager = room.users[0];
  }

  await persistRoom(room);

  return {
    updatedUsers: room.users,
    roomRemoved: false,
    newManager
  };
}

async function getWaitingRooms() {
  const redis = await ensureRedisConnection();
  const ids = await redis.sMembers(WAITING_ROOMS_SET);
  if (!ids || ids.length === 0) {
    return [];
  }

  const rooms = await Promise.all(ids.map((id) => fetchRoom(id)));
  return rooms.filter(Boolean);
}

async function getRoomById(roomId) {
  return fetchRoom(roomId);
}

async function getRoomByUser(socketId) {
  const roomId = await userService.getUserRoom(socketId);
  return roomId ? fetchRoom(roomId) : null;
}

async function updateRoomStatus(roomId, status) {
  const room = await fetchRoom(roomId);
  if (!room) return false;
  room.status = status;
  await persistRoom(room);
  return true;
}

async function saveRoomState(room) {
  await persistRoom(room);
}

module.exports = {
  createRoom,
  joinRoom,
  leaveRoom,
  getWaitingRooms,
  getRoomById,
  getRoomByUser,
  updateRoomStatus,
  saveRoomState
};
