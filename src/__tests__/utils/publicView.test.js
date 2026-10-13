const { toPublicUser, toPublicUsers, toPublicRoom, toPublicRooms } = require('../../utils/publicView');

const secretRoom = () => ({
  id: 'r1', name: '방', status: 'playing', maxUserCnt: 4,
  gameState: { centerCards: [{ fruit: 'banana', count: 1 }], discardedCards: [{ fruit: 'lemon', count: 3 }], playerStacks: {} },
  users: [
    { id: 'a', name: 'A', readyStatus: 'playing', manager: true, score: 3, isActive: true,
      cardPack: [{ fruit: 'plum', count: 2 }, { fruit: 'plum', count: 3 }] },
    { id: 'b', name: 'B', readyStatus: 'playing', manager: false, score: 0, isActive: true, cardPack: [] },
  ],
});

describe('publicView', () => {
  test('유저: 손패는 빼고 장수만 보낸다', () => {
    const u = toPublicUser(secretRoom().users[0]);
    expect(u).toEqual({ id: 'a', name: 'A', readyStatus: 'playing', manager: true, score: 3, cardCount: 2, isActive: true });
    expect(u).not.toHaveProperty('cardPack');
  });

  test('방: gameState(버림 더미·중앙 카드 내용)와 손패가 포함되지 않는다', () => {
    const pub = toPublicRoom(secretRoom());
    expect(Object.keys(pub).sort()).toEqual(['id', 'maxUserCnt', 'name', 'status', 'users']);
    expect(JSON.stringify(pub)).not.toMatch(/cardPack|gameState|discardedCards|plum|lemon/);
    expect(pub.users.map(u => u.cardCount)).toEqual([2, 0]);
  });

  test('원본 객체를 변경하지 않는다', () => {
    const room = secretRoom();
    toPublicRoom(room);
    expect(room.users[0].cardPack).toHaveLength(2);
    expect(room.gameState).toBeDefined();
  });

  test('방 목록/유저 목록 변환, 잘못된 입력은 안전하게 처리', () => {
    expect(toPublicRooms([secretRoom(), secretRoom()])).toHaveLength(2);
    expect(toPublicUsers(secretRoom().users)).toHaveLength(2);
    expect(toPublicRooms(undefined)).toEqual([]);
    expect(toPublicUsers(null)).toEqual([]);
    expect(toPublicRoom(null)).toBeNull();
  });
});
