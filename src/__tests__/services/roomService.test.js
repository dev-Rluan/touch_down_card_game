// Redis / userService를 mock 처리해 leaveRoom의 게임 중 이탈 처리만 검증
const store = {};
const mockTx = () => {
  const tx = {
    set: jest.fn((k, v) => { store[k] = v; return tx; }),
    hSet: jest.fn(() => tx),
    sAdd: jest.fn(() => tx),
    sRem: jest.fn(() => tx),
    del: jest.fn((k) => { delete store[k]; return tx; }),
    hDel: jest.fn(() => tx),
    exec: jest.fn(async () => []),
  };
  return tx;
};
const mockRedis = {
  get: jest.fn(async (k) => store[k] ?? null),
  multi: jest.fn(mockTx),
};

jest.mock('../../config/redisClient', () => ({
  ensureRedisConnection: jest.fn(async () => mockRedis),
}));
jest.mock('../../services/userServices', () => ({
  setUserRoom: jest.fn(async () => {}),
  getUserRoom: jest.fn(async () => ''),
  getUserName: jest.fn(async () => 'name'),
}));

const { leaveRoom } = require('../../services/roomService');

const card = (fruit, count) => ({ fruit, count });

function seedPlayingRoom({ currentTurn = 0, users = ['p1', 'p2', 'p3'] } = {}) {
  const room = {
    id: 'r1',
    name: '방',
    status: 'playing',
    maxUserCnt: 4,
    users: users.map((id, i) => ({ id, name: id, manager: i === 0, readyStatus: 'playing', score: 0, cardPack: [card('lemon', 1)] })),
    gameState: {
      phase: 'playing',
      currentTurn,
      centerCards: [card('banana', 5)],
      playerStacks: Object.fromEntries(users.map((id) => [id, id === 'p2' ? [card('banana', 5)] : []])),
      discardedCards: [],
    },
  };
  store['room:data:r1'] = JSON.stringify(room);
  return room;
}

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  jest.clearAllMocks();
});

describe('leaveRoom - 게임 진행 중 이탈', () => {
  test('현재 턴보다 앞선 플레이어가 나가면 턴 인덱스를 보정한다', async () => {
    seedPlayingRoom({ currentTurn: 2 }); // p3 차례
    const result = await leaveRoom('p1', 'r1');

    expect(result.wasPlaying).toBe(true);
    expect(result.room.users.map((u) => u.id)).toEqual(['p2', 'p3']);
    // 여전히 p3 차례여야 한다
    expect(result.room.users[result.room.gameState.currentTurn].id).toBe('p3');
  });

  test('나간 플레이어의 스택은 할리갈리 판정에서 제외된다', async () => {
    seedPlayingRoom();
    const result = await leaveRoom('p2', 'r1');

    expect(result.room.gameState.playerStacks).not.toHaveProperty('p2');
    // 이미 낸 카드는 중앙 더미에 남는다
    expect(result.room.gameState.centerCards).toHaveLength(1);
  });

  test('마지막 순서의 플레이어가 자기 턴에 나가면 턴이 처음으로 돌아간다', async () => {
    seedPlayingRoom({ currentTurn: 2 });
    const result = await leaveRoom('p3', 'r1');

    expect(result.room.gameState.currentTurn).toBe(0);
  });

  test('대기 중인 방에서 나가면 wasPlaying은 false다', async () => {
    const room = seedPlayingRoom();
    room.status = 'waiting';
    room.gameState = null;
    store['room:data:r1'] = JSON.stringify(room);

    const result = await leaveRoom('p1', 'r1');
    expect(result.wasPlaying).toBe(false);
  });
});
