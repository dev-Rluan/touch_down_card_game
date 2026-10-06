const { toPublicUser, toPublicRoom, toRoomSummary } = require('../../utils/roomSerializer');

const room = {
  id: 'r1',
  name: '방',
  status: 'waiting',
  maxUserCnt: 4,
  gameState: { centerCards: [{ fruit: 'banana', count: 1 }] },
  users: [
    { id: 'p1', name: 'A', readyStatus: 'ready', score: 3, order: 0, manager: true, cardPack: [{ fruit: 'lemon', count: 2 }] },
    { id: 'p2', name: 'B', readyStatus: 'waiting', score: 0, order: 1, manager: false, cardPack: [] },
  ],
};

describe('roomSerializer', () => {
  test('toPublicUser는 손패(cardPack)를 노출하지 않는다', () => {
    const user = toPublicUser(room.users[0]);
    expect(user).not.toHaveProperty('cardPack');
    expect(user).toMatchObject({ id: 'p1', name: 'A', readyStatus: 'ready', manager: true });
  });

  test('toPublicRoom은 gameState와 손패를 제외한다', () => {
    const pub = toPublicRoom(room);
    expect(pub).not.toHaveProperty('gameState');
    expect(pub.users.every((u) => !('cardPack' in u))).toBe(true);
  });

  test('toRoomSummary는 인원 수와 최소 유저 정보만 담는다', () => {
    const summary = toRoomSummary(room);
    expect(summary.userCount).toBe(2);
    expect(summary.users).toEqual([{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }]);
    expect(summary).not.toHaveProperty('gameState');
  });
});
