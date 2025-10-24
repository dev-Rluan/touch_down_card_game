// /services/userService.js
const connectedClients = {};

// 유저 접속 처리
function connectUser(socketId, defaultName) {
  connectedClients[socketId] = {
    name: defaultName,
    roomId: ''
  };
}

// 유저 정보 제거
function disconnectUser(socketId) {
  delete connectedClients[socketId];
}

// 닉네임 변경
function updateUserName(socketId, newName) {
  if (!connectedClients[socketId]) {
    throw new Error("해당 유저가 존재하지 않습니다.");
  }
  connectedClients[socketId].name = newName;
}

// roomId 세팅
function setUserRoom(socketId, roomId) {
  if (!connectedClients[socketId]) return;
  connectedClients[socketId].roomId = roomId;
}

// 유저 이름 조회
function getUserName(socketId) {
  return connectedClients[socketId]?.name || null;
}

// 유저 roomId 조회
function getUserRoom(socketId) {
  return connectedClients[socketId]?.roomId || '';
}

module.exports = {
  connectUser,
  disconnectUser,
  updateUserName,
  setUserRoom,
  getUserName,
  getUserRoom,
  // ...
};