// ── Redis mock ────────────────────────────────────────────────────────────────
const hstore = {};
const sstore = {};

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
  expire: jest.fn(async () => true),
};

jest.mock('../../config/redisClient', () => ({
  ensureRedisConnection: jest.fn().mockResolvedValue(mockRedis),
}));

const { updateAndCheck, getDailyMissions, getAllDefinitions } = require('../../services/dailyMissionService');

beforeEach(() => {
  Object.keys(hstore).forEach((k) => delete hstore[k]);
  Object.keys(sstore).forEach((k) => delete sstore[k]);
  jest.clearAllMocks();
});

describe('getAllDefinitions', () => {
  test('미션 정의 배열을 반환한다', () => {
    const defs = getAllDefinitions();
    expect(Array.isArray(defs)).toBe(true);
    expect(defs.length).toBeGreaterThan(0);
    defs.forEach((d) => {
      expect(d).toHaveProperty('id');
      expect(d).toHaveProperty('stat');
      expect(d).toHaveProperty('goal');
      expect(d).toHaveProperty('reward');
    });
  });
});

describe('updateAndCheck', () => {
  test('목표 달성 시 완료된 미션을 반환한다', async () => {
    // play_1: gamesPlayed >= 1
    const completed = await updateAndCheck('acc1', { gamesPlayed: 1 });
    expect(completed.some((m) => m.id === 'play_1')).toBe(true);
  });

  test('같은 미션은 중복 반환하지 않는다', async () => {
    await updateAndCheck('acc1', { gamesPlayed: 1 });
    const second = await updateAndCheck('acc1', { gamesPlayed: 1 });
    expect(second.some((m) => m.id === 'play_1')).toBe(false);
  });

  test('목표 미달 시 빈 배열 반환', async () => {
    const result = await updateAndCheck('acc2', { gamesPlayed: 0 });
    expect(result).toEqual([]);
  });

  test('TTL 설정을 위해 expire를 호출한다', async () => {
    await updateAndCheck('acc3', { gamesPlayed: 1 });
    expect(mockRedis.expire).toHaveBeenCalled();
  });

  test('accountId가 null이면 빈 배열 반환', async () => {
    const result = await updateAndCheck(null, { gamesPlayed: 1 });
    expect(result).toEqual([]);
  });
});

describe('getDailyMissions', () => {
  test('진행 상태와 완료 여부를 포함해 반환한다', async () => {
    await updateAndCheck('acc4', { gamesPlayed: 1 });
    const { missions, completedCount, totalCount } = await getDailyMissions('acc4');

    expect(missions.length).toBeGreaterThan(0);
    expect(completedCount).toBeGreaterThanOrEqual(1);
    expect(totalCount).toBe(missions.length);

    const play1 = missions.find((m) => m.id === 'play_1');
    expect(play1.completed).toBe(true);
  });

  test('accountId가 없으면 진행도 0으로 반환한다', async () => {
    const { missions, completedCount } = await getDailyMissions(null);
    expect(completedCount).toBe(0);
    missions.forEach((m) => expect(m.current).toBe(0));
  });
});
