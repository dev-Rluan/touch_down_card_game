// /services/userService.js
const { ensureRedisConnection } = require('../config/redisClient');

const USER_KEY_PREFIX = 'user:';

function getUserKey(socketId) {
  return `${USER_KEY_PREFIX}${socketId}`;
}

async function assertUserExists(redis, socketId) {
  const exists = await redis.exists(getUserKey(socketId));
  if (!exists) {
    throw new Error('해당 유저가 존재하지 않습니다.');
  }
}

// 유저 접속 처리
async function connectUser(socketId, defaultName) {
  const redis = await ensureRedisConnection();
  await redis.hSet(getUserKey(socketId), {
    name: defaultName,
    roomId: ''
  });
}

// 유저 정보 제거
async function disconnectUser(socketId) {
  const redis = await ensureRedisConnection();
  await redis.del(getUserKey(socketId));
}

// 닉네임 변경
async function updateUserName(socketId, newName) {
  const redis = await ensureRedisConnection();
  await assertUserExists(redis, socketId);
  await redis.hSet(getUserKey(socketId), 'name', newName);
}

// roomId 세팅
async function setUserRoom(socketId, roomId) {
  const redis = await ensureRedisConnection();
  if (!(await redis.exists(getUserKey(socketId)))) return;
  await redis.hSet(getUserKey(socketId), 'roomId', roomId || '');
}

// 유저 이름 조회
async function getUserName(socketId) {
  const redis = await ensureRedisConnection();
  return (await redis.hGet(getUserKey(socketId), 'name')) || null;
}

// 유저 roomId 조회
async function getUserRoom(socketId) {
  const redis = await ensureRedisConnection();
  return (await redis.hGet(getUserKey(socketId), 'roomId')) || '';
}

module.exports = {
  connectUser,
  disconnectUser,
  updateUserName,
  setUserRoom,
  getUserName,
  getUserRoom
};
