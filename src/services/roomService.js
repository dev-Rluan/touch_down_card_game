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

/**
 * 방 저장
 * @param {Object} room
 * @param {{reindex?: boolean}} [options]
 *   reindex=false 이면 방 데이터만 저장한다. 이름 색인(ROOM_NAME_HASH)과 대기 방 목록(WAITING_ROOMS_SET)은
 *   방 생성/입장/퇴장/게임 시작/종료처럼 이름·상태가 바뀔 때만 갱신하면 되므로,
 *   카드 내기·벨 같은 게임 중 고빈도 경로에서는 끄고 Redis 명령 수를 줄인다.
 */
async function persistRoom(room, { reindex = true } = {}) {
  const redis = await ensureRedisConnection();
  await redis.set(getRoomKey(room.id), JSON.stringify(room));
  if (!reindex) return;
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

  // 게임 중 퇴장: 차례(currentTurn)는 users 배열의 "위치"를 가리키므로 퇴장자의 위치에 맞춰 보정하지 않으면
  // 엉뚱한 사람이 차례를 가져가거나 아무도 낼 수 없는 상태가 된다.
  if (room.status === 'playing' && room.gameState) {
    const turn = room.gameState.currentTurn ?? 0;
    if (userIndex < turn) {
      room.gameState.currentTurn = turn - 1; // 앞사람이 빠지면 한 칸 당겨 같은 사람이 계속 차례를 가진다
    }
    // userIndex === turn: 인덱스 유지 → 배열이 당겨져 다음 사람이 차례를 이어받는다
    if (room.gameState.currentTurn >= room.users.length) {
      room.gameState.currentTurn = 0;
    }
    // 퇴장자가 바닥에 낸 카드 더미는 벨 판정(맨 위 카드 합)에 영향을 주지 않도록 제거
    if (room.gameState.playerStacks) {
      delete room.gameState.playerStacks[socketId];
    }
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
  if (!ids || ids.length === 0) return [];

  // mGet으로 N+1 쿼리 → 2회 쿼리로 최적화 (1회: sMembers, 1회: mGet)
  const keys = ids.map(getRoomKey);
  const rawList = await redis.mGet(keys);
  return rawList
    .map(raw => (raw ? JSON.parse(raw) : null))
    .filter(Boolean);
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

async function saveRoomState(room, options) {
  await persistRoom(room, options);
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
