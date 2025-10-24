// /services/roomService.js
const { v4: uuidv4 } = require('uuid');
const userService = require('./userServices');

/**
 * 방 관리 서비스
 * 방 생성, 입장, 나가기, 조회 등의 기능을 제공합니다.
 */

// 방 목록 저장소
const roomList = [];

/**
 * 방 생성
 * @param {string} socketId - 소켓 ID
 * @param {string} roomName - 방 이름
 * @param {number} maxUserCnt - 최대 인원수
 * @returns {Object} 생성된 방 정보
 * @throws {Error} 방 이름 중복 또는 유효하지 않은 입력값
 */
function createRoom(socketId, roomName, maxUserCnt) {
  // 입력값 검증
  if (!socketId || !roomName || !roomName.trim()) {
    throw new Error("필수 입력값이 누락되었습니다.");
  }

  if (maxUserCnt && (maxUserCnt < 2 || maxUserCnt > 8)) {
    throw new Error("최대 인원수는 2명 이상 8명 이하여야 합니다.");
  }

  // 중복 이름 체크
  const existing = roomList.find(r => r.name === roomName.trim());
  if (existing) {
    throw new Error("이미 같은 이름의 방이 존재합니다.");
  }

  // 사용자가 이미 다른 방에 있는지 확인
  const currentRoom = userService.getUserRoom(socketId);
  if (currentRoom) {
    throw new Error("이미 다른 방에 참여 중입니다.");
  }

  // roomId 생성
  const roomId = _createRoomId();
  const userName = userService.getUserName(socketId);

  if (!userName) {
    throw new Error("사용자 정보를 찾을 수 없습니다.");
  }

  const newRoom = {
    id: roomId,
    name: roomName.trim(),
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
    createdAt: new Date().toISOString()
  };
  
  roomList.push(newRoom);
  userService.setUserRoom(socketId, roomId);

  return newRoom;
}

/**
 * 방 입장
 * @param {string} socketId - 소켓 ID
 * @param {string} roomId - 방 ID
 * @returns {Object} 방 정보
 * @throws {Error} 방이 존재하지 않거나 입장할 수 없는 상태
 */
function joinRoom(socketId, roomId) {
  // 입력값 검증
  if (!socketId || !roomId) {
    throw new Error("필수 입력값이 누락되었습니다.");
  }

  const room = roomList.find(r => r.id === roomId);
  if (!room) {
    throw new Error("존재하지 않는 방입니다.");
  }

  // 사용자가 이미 다른 방에 있는지 확인
  const currentRoom = userService.getUserRoom(socketId);
  if (currentRoom) {
    throw new Error("이미 다른 방에 참여 중입니다.");
  }

  // 방 상태 확인
  if (room.status !== 'waiting') {
    throw new Error("이 방은 입장할 수 없는 상태입니다.");
  }

  // 방 인원 확인
  if (room.users.length >= room.maxUserCnt) {
    throw new Error("방 인원이 가득 찼습니다.");
  }

  // 중복 입장 확인
  const existingUser = room.users.find(u => u.id === socketId);
  if (existingUser) {
    throw new Error("이미 이 방에 참여 중입니다.");
  }

  const userName = userService.getUserName(socketId);
  if (!userName) {
    throw new Error("사용자 정보를 찾을 수 없습니다.");
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
  userService.setUserRoom(socketId, roomId);
  
  return room;
}

/**
 * 방 나가기
 * @param {string} socketId - 소켓 ID
 * @param {string} roomId - 방 ID
 * @returns {Object} 결과 정보 { updatedUsers, roomRemoved, newManager }
 * @throws {Error} 방이 존재하지 않거나 사용자가 방에 없음
 */
function leaveRoom(socketId, roomId) {
  // 입력값 검증
  if (!socketId || !roomId) {
    throw new Error("필수 입력값이 누락되었습니다.");
  }

  const roomIndex = roomList.findIndex(r => r.id === roomId);
  if (roomIndex < 0) {
    throw new Error("해당 방이 존재하지 않습니다.");
  }
  
  const room = roomList[roomIndex];
  const userIndex = room.users.findIndex(u => u.id === socketId);
  
  if (userIndex < 0) {
    throw new Error("해당 방에 참여하지 않은 사용자입니다.");
  }

  const wasManager = room.users[userIndex].manager;
  
  // 사용자 제거
  room.users.splice(userIndex, 1);
  userService.setUserRoom(socketId, '');

  // 방이 비었으면 방 삭제
  if (room.users.length === 0) {
    roomList.splice(roomIndex, 1);
    return { 
      updatedUsers: [], 
      roomRemoved: true, 
      newManager: null 
    };
  }

  // 방장이 나간 경우 새로운 방장 지정
  let newManager = null;
  if (wasManager) {
    const nextManager = room.users[0];
    nextManager.manager = true;
    newManager = nextManager;
  }
  
  return {
    updatedUsers: room.users,
    roomRemoved: false,
    newManager: newManager
  };
}

/**
 * 대기 중인 방 목록 조회
 * @returns {Array} 대기 중인 방 목록
 */
function getWaitingRooms() {
  return roomList.filter(r => r.status === 'waiting');
}

/**
 * 특정 방 정보 조회
 * @param {string} roomId - 방 ID
 * @returns {Object|null} 방 정보 또는 null
 */
function getRoomById(roomId) {
  return roomList.find(r => r.id === roomId) || null;
}

/**
 * 사용자가 참여 중인 방 조회
 * @param {string} socketId - 소켓 ID
 * @returns {Object|null} 방 정보 또는 null
 */
function getRoomByUser(socketId) {
  const roomId = userService.getUserRoom(socketId);
  return roomId ? getRoomById(roomId) : null;
}

/**
 * 방 상태 변경
 * @param {string} roomId - 방 ID
 * @param {string} status - 새로운 상태
 * @returns {boolean} 성공 여부
 */
function updateRoomStatus(roomId, status) {
  const room = getRoomById(roomId);
  if (!room) return false;
  
  room.status = status;
  return true;
}

/**
 * 고유한 방 ID 생성
 * @returns {string} 고유한 방 ID
 * @private
 */
function _createRoomId() {
  let unique = false;
  let roomId = "";
  let attempts = 0;
  const maxAttempts = 10;
  
  while (!unique && attempts < maxAttempts) {
    roomId = uuidv4();
    if (!roomList.find(r => r.id === roomId)) {
      unique = true;
    }
    attempts++;
  }
  
  if (!unique) {
    throw new Error("방 ID 생성에 실패했습니다.");
  }
  
  return roomId;
}

module.exports = {
  createRoom,
  joinRoom,
  leaveRoom,
  getWaitingRooms,
  getRoomById,
  getRoomByUser,
  updateRoomStatus
};