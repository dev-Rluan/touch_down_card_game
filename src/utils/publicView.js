// 클라이언트로 내보내는 방/유저 객체의 "공개용 뷰"
//
// 서버가 Redis 에 저장하는 방 객체에는 모든 플레이어의 손패(cardPack)와 게임 상태(gameState)가 들어 있다.
// 이를 그대로 emit 하면 개발자도구로 상대 카드를 전부 볼 수 있으므로,
// 클라이언트에는 화면에 필요한 공개 정보(장수 등)만 보낸다. 손패는 'yourHand' 로 본인에게만 전달한다.

function toPublicUser(user) {
  if (!user) return user;
  return {
    id: user.id,
    name: user.name,
    readyStatus: user.readyStatus,
    manager: !!user.manager,
    score: user.score || 0,
    cardCount: Array.isArray(user.cardPack) ? user.cardPack.length : 0,
    isActive: user.isActive,
  };
}

function toPublicUsers(users) {
  return Array.isArray(users) ? users.map(toPublicUser) : [];
}

function toPublicRoom(room) {
  if (!room) return room;
  return {
    id: room.id,
    name: room.name,
    status: room.status,
    maxUserCnt: room.maxUserCnt,
    private: !!room.private,
    users: toPublicUsers(room.users),
  };
}

function toPublicRooms(rooms) {
  // 목록용: 비공개 방은 빼고 보낸다
  return Array.isArray(rooms) ? rooms.filter(r => r && !r.private).map(toPublicRoom) : [];
}

module.exports = { toPublicUser, toPublicUsers, toPublicRoom, toPublicRooms };
