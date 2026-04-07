// roomService를 mock 처리해 Redis 의존성 없이 테스트
jest.mock('../../services/roomService', () => ({
  getRoomById: jest.fn(),
  saveRoomState: jest.fn().mockResolvedValue(undefined),
}));

const { getRoomById, saveRoomState } = require('../../services/roomService');
const { startGame, playCard, handleHalliGalli, checkGameEnd, resetGame } = require('../../services/gameService');

// ── 헬퍼 ──────────────────────────────────────────────────────────────────
const makeCard = (fruit, count) => ({ fruit, count });

const makePlayer = (id, name, cards = []) => ({
  id,
  name,
  cardPack: cards,
  score: 0,
  isActive: true,
  readyStatus: 'waiting',
  manager: false,
});

const makeRoom = (overrides = {}) => ({
  id: 'room-1',
  name: '테스트방',
  status: 'waiting',
  gameState: null,
  users: [
    makePlayer('p1', '플레이어1', [makeCard('strawberry', 2), makeCard('banana', 1)]),
    makePlayer('p2', '플레이어2', [makeCard('lemon', 3), makeCard('plum', 2)]),
  ],
  ...overrides,
});

const makePlayingRoom = (overrides = {}) => {
  const room = makeRoom({
    status: 'playing',
    gameState: {
      phase: 'playing',
      currentTurn: 0,
      centerCards: [],
      playerStacks: { p1: [], p2: [] },
      discardedCards: [],
      gameStartTime: new Date().toISOString(),
      lastActionTime: new Date().toISOString(),
    },
    ...overrides,
  });
  return room;
};
// ──────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('startGame', () => {
  test('정상적으로 게임을 시작한다', async () => {
    const room = makeRoom();
    getRoomById.mockResolvedValue(room);

    const result = await startGame('room-1');

    expect(result.status).toBe('playing');
    expect(result.gameState).not.toBeNull();
    expect(result.gameState.phase).toBe('playing');
    expect(saveRoomState).toHaveBeenCalledWith(room);
  });

  test('플레이어가 1명 이하면 에러를 던진다', async () => {
    const room = makeRoom({ users: [makePlayer('p1', '혼자')] });
    getRoomById.mockResolvedValue(room);

    await expect(startGame('room-1')).rejects.toThrow('최소 2명');
  });

  test('존재하지 않는 방이면 에러를 던진다', async () => {
    getRoomById.mockResolvedValue(null);
    await expect(startGame('없는방')).rejects.toThrow('방을 찾을 수 없습니다');
  });

  test('게임 시작 후 각 플레이어에게 카드가 분배된다', async () => {
    const room = makeRoom();
    getRoomById.mockResolvedValue(room);

    const result = await startGame('room-1');
    result.users.forEach(user => {
      expect(user.cardPack.length).toBeGreaterThan(0);
    });
  });
});

describe('playCard', () => {
  test('정상 턴에 카드를 낼 수 있다', async () => {
    const room = makePlayingRoom();
    getRoomById.mockResolvedValue(room);

    const result = await playCard('room-1', 'p1', 0);

    expect(result.playedCard).toBeDefined();
    expect(result.centerCards.length).toBeGreaterThan(0);
    expect(saveRoomState).toHaveBeenCalled();
  });

  test('자신의 턴이 아니면 에러를 던진다', async () => {
    const room = makePlayingRoom(); // currentTurn = 0 → p1 차례
    getRoomById.mockResolvedValue(room);

    await expect(playCard('room-1', 'p2', 0)).rejects.toThrow('당신의 턴이 아닙니다');
  });

  test('유효하지 않은 카드 인덱스면 에러를 던진다', async () => {
    const room = makePlayingRoom();
    getRoomById.mockResolvedValue(room);

    await expect(playCard('room-1', 'p1', 99)).rejects.toThrow('유효하지 않은 카드');
  });

  test('존재하지 않는 플레이어면 에러를 던진다', async () => {
    const room = makePlayingRoom();
    getRoomById.mockResolvedValue(room);

    await expect(playCard('room-1', '없는플레이어', 0)).rejects.toThrow('플레이어를 찾을 수 없습니다');
  });

  test('카드를 내면 다음 플레이어로 턴이 넘어간다', async () => {
    const room = makePlayingRoom();
    getRoomById.mockResolvedValue(room);

    const result = await playCard('room-1', 'p1', 0);
    expect(result.nextTurn).toBe(1);
  });
});

describe('handleHalliGalli', () => {
  test('조건 충족 시 성공하고 중앙 카드를 획득한다', async () => {
    const room = makePlayingRoom();
    // 할리갈리 조건: strawberry 2 + strawberry 3 = 5
    room.gameState.playerStacks = {
      p1: [makeCard('strawberry', 2)],
      p2: [makeCard('strawberry', 3)],
    };
    room.gameState.centerCards = [makeCard('strawberry', 2), makeCard('strawberry', 3)];
    getRoomById.mockResolvedValue(room);

    const result = await handleHalliGalli('room-1', 'p1');

    expect(result.success).toBe(true);
    expect(result.scoreGained).toBeGreaterThan(0);
    expect(result.centerCards).toEqual([]);
  });

  test('조건 미충족 시 실패하고 카드를 한 장 잃는다', async () => {
    const room = makePlayingRoom();
    room.gameState.playerStacks = {
      p1: [makeCard('strawberry', 1)],
      p2: [makeCard('banana', 2)],
    };
    // 중앙에 카드가 있어야 벨 클릭 가능
    room.gameState.centerCards = [makeCard('strawberry', 1), makeCard('banana', 2)];
    getRoomById.mockResolvedValue(room);

    const beforeCount = room.users.find(u => u.id === 'p1').cardPack.length;
    const result = await handleHalliGalli('room-1', 'p1');

    expect(result.success).toBe(false);
    const afterCount = room.users.find(u => u.id === 'p1').cardPack.length;
    expect(afterCount).toBe(beforeCount - 1);
  });

  test('존재하지 않는 방이면 에러를 던진다', async () => {
    getRoomById.mockResolvedValue(null);
    await expect(handleHalliGalli('없는방', 'p1')).rejects.toThrow('게임이 시작되지 않았습니다');
  });

  test('게임 phase가 playing이 아니면 에러를 던진다', async () => {
    const room = makePlayingRoom();
    room.gameState.phase = 'finished';
    room.gameState.centerCards = [makeCard('strawberry', 2)];
    getRoomById.mockResolvedValue(room);
    await expect(handleHalliGalli('room-1', 'p1')).rejects.toThrow('게임이 진행 중이 아닙니다');
  });

  test('중앙 카드가 없으면 에러를 던진다', async () => {
    const room = makePlayingRoom();
    room.gameState.centerCards = [];
    getRoomById.mockResolvedValue(room);
    await expect(handleHalliGalli('room-1', 'p1')).rejects.toThrow('아직 카드가 없습니다');
  });
});

describe('checkGameEnd', () => {
  test('카드가 있는 플레이어가 2명 이상이면 게임 중이다', async () => {
    const room = makePlayingRoom();
    getRoomById.mockResolvedValue(room);

    const result = await checkGameEnd('room-1');
    expect(result.isEnded).toBe(false);
  });

  test('카드 있는 플레이어가 1명이면 게임이 종료된다', async () => {
    const room = makePlayingRoom();
    room.users[1].cardPack = []; // p2 카드 없음
    getRoomById.mockResolvedValue(room);

    const result = await checkGameEnd('room-1');

    expect(result.isEnded).toBe(true);
    expect(result.winner).toBeDefined();
    expect(result.winner.id).toBe('p1');
    expect(result.finalScores).toHaveLength(2);
  });

  test('방이 없으면 isEnded: false를 반환한다', async () => {
    getRoomById.mockResolvedValue(null);
    const result = await checkGameEnd('없는방');
    expect(result.isEnded).toBe(false);
  });
});

describe('resetGame', () => {
  test('게임 상태를 초기화한다', async () => {
    const room = makePlayingRoom();
    getRoomById.mockResolvedValue(room);

    await resetGame('room-1');

    expect(room.status).toBe('waiting');
    expect(room.gameState).toBeNull();
    room.users.forEach(user => {
      expect(user.cardPack).toEqual([]);
      expect(user.score).toBe(0);
      expect(user.readyStatus).toBe('waiting');
    });
    expect(saveRoomState).toHaveBeenCalled();
  });

  test('존재하지 않는 방이면 에러를 던진다', async () => {
    getRoomById.mockResolvedValue(null);
    await expect(resetGame('없는방')).rejects.toThrow('방을 찾을 수 없습니다');
  });
});
