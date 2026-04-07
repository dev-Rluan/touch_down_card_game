// ── Redis mock ────────────────────────────────────────────────────────────────
const hstore = {};  // key → { field: value }
const sstore = {};  // key → Set<string>

const mockRedis = {
  hIncrBy: jest.fn(async (key, field, incr) => {
    if (!hstore[key]) hstore[key] = {};
    const v = parseInt(hstore[key][field] || '0', 10) + incr;
    hstore[key][field] = String(v);
    return v;
  }),
  hGetAll: jest.fn(async (key) => hstore[key] ?? {}),
  sAdd: jest.fn(async (key, val) => {
    if (!sstore[key]) sstore[key] = new Set();
    sstore[key].add(val);
  }),
  sMembers: jest.fn(async (key) => [...(sstore[key] ?? [])]),
};

jest.mock('../../config/redisClient', () => ({
  ensureRedisConnection: jest.fn().mockResolvedValue(mockRedis),
}));

const { updateAndCheck, getAchievements, getAllDefinitions } = require('../../services/achievementService');

beforeEach(() => {
  Object.keys(hstore).forEach((k) => delete hstore[k]);
  Object.keys(sstore).forEach((k) => delete sstore[k]);
  jest.clearAllMocks();
});

describe('getAllDefinitions', () => {
  test('업적 정의 배열을 반환한다', () => {
    const defs = getAllDefinitions();
    expect(Array.isArray(defs)).toBe(true);
    expect(defs.length).toBeGreaterThan(0);
    defs.forEach((d) => {
      expect(d).toHaveProperty('id');
      expect(d).toHaveProperty('stat');
      expect(d).toHaveProperty('threshold');
    });
  });
});

describe('updateAndCheck', () => {
  test('임계값 도달 시 업적을 반환한다', async () => {
    // first_win: totalWins >= 1
    const unlocked = await updateAndCheck('acc1', { totalWins: 1 });
    expect(unlocked.some((a) => a.id === 'first_win')).toBe(true);
  });

  test('같은 업적은 중복 반환하지 않는다', async () => {
    await updateAndCheck('acc1', { totalWins: 1 });
    const second = await updateAndCheck('acc1', { totalWins: 1 });
    expect(second.some((a) => a.id === 'first_win')).toBe(false);
  });

  test('임계값 미달 시 빈 배열 반환', async () => {
    const result = await updateAndCheck('acc2', { totalWins: 0 });
    expect(result).toEqual([]);
  });

  test('여러 업적을 동시에 달성할 수 있다', async () => {
    // games_10 (10판), first_game (1판) 동시 달성
    const unlocked = await updateAndCheck('acc3', { totalGames: 10 });
    const ids = unlocked.map((a) => a.id);
    expect(ids).toContain('first_game');
    expect(ids).toContain('games_10');
  });

  test('accountId가 null이면 빈 배열 반환', async () => {
    const result = await updateAndCheck(null, { totalWins: 1 });
    expect(result).toEqual([]);
  });
});

describe('getAchievements', () => {
  test('모든 업적 정의와 진행 상태를 반환한다', async () => {
    await updateAndCheck('acc4', { totalGames: 1 });
    const { achievements, stats } = await getAchievements('acc4');

    expect(achievements.length).toBeGreaterThan(0);
    const first = achievements.find((a) => a.id === 'first_game');
    expect(first.unlocked).toBe(true);
    expect(stats.totalGames).toBe(1);
  });

  test('accountId가 없으면 빈 결과를 반환한다', async () => {
    const result = await getAchievements(null);
    expect(result.achievements).toEqual([]);
  });
});
