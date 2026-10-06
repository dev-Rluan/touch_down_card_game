/**
 * 클라이언트로 전송할 방/유저 데이터 직렬화
 *
 * Redis에 저장된 방 객체에는 각 유저의 cardPack(손패)과 gameState가 들어 있다.
 * 이를 그대로 브로드캐스트하면 페이로드가 커지고 다른 플레이어의 손패가 노출되므로,
 * 화면에 필요한 필드만 골라서 보낸다.
 */

/**
 * @param {Object} user
 * @returns {Object} 손패를 제외한 공개 유저 정보
 */
function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    readyStatus: user.readyStatus,
    score: user.score || 0,
    order: user.order,
    manager: !!user.manager,
  };
}

/**
 * 대기실/입장 응답용 방 정보
 * @param {Object} room
 */
function toPublicRoom(room) {
  return {
    id: room.id,
    name: room.name,
    status: room.status,
    maxUserCnt: room.maxUserCnt,
    users: (room.users || []).map(toPublicUser),
  };
}

/**
 * 로비 방 목록용 요약 정보
 * @param {Object} room
 */
function toRoomSummary(room) {
  const users = room.users || [];
  return {
    id: room.id,
    name: room.name,
    status: room.status,
    maxUserCnt: room.maxUserCnt,
    userCount: users.length,
    // 구버전 클라이언트(room.users.length 사용) 호환용 최소 정보
    users: users.map(u => ({ id: u.id, name: u.name })),
  };
}

module.exports = { toPublicUser, toPublicRoom, toRoomSummary };
