// ── Redis mock ────────────────────────────────────────────────────────────────
const store = {};
const zsets = {}; // key → Map<member, score>

function zsetOf(key) {
  if (!zsets[key]) zsets[key] = new Map();
  return zsets[key];
}

const mockRedis = {
  hSet: jest.fn(async (key, obj) => { store[key] = { ...store[key], ...obj }; }),
  hGetAll: jest.fn(async (key) => store[key] ?? {}),
  zIncrBy: jest.fn(async (key, incr, member) => {
    const z = zsetOf(key);
    z.set(member, (z.get(member) || 0) + incr);
    return z.get(member);
  }),
  zRangeWithScores: jest.fn(async (key, start, stop, opts) => {
    const z = zsetOf(key);
    const sorted = [...z.entries()].sort((a, b) => b[1] - a[1]);
    return sorted.slice(start, stop + 1).map(([value, score]) => ({ value, score }));
  }),
  zRevRank: jest.fn(async (key, member) => {
    const z = zsetOf(key);
    const sorted = [...z.entries()].sort((a, b) => b[1] - a[1]);
    const idx = sorted.findIndex(([m]) => m === member);
    return idx === -1 ? null : idx;
  }),
  zScore: jest.fn(async (key, member) => {
    return zsetOf(key).get(member) ?? null;
  }),
  expire: jest.fn(async () => true),
};

jest.mock('../../config/redisClient', () => ({
  ensureRedisConnection: jest.fn().mockResolvedValue(mockRedis),
}));

const { recordResult, getLeaderboard, getUserRank } = require('../../services/rankingService');

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  Object.keys(zsets).forEach((k) => delete zsets[k]);
  jest.clearAllMocks();
});

describe('recordResult', () => {
  test('점수와 승리수를 전체/주간/월간 랭킹에 기록한다', async () => {
    await recordResult('acc1', '플레이어1', '', true, 30);

    expect(mockRedis.zIncrBy).toHaveBeenCalledWith('rank:alltime:score', 30, 'acc1');
    expect(mockRedis.zIncrBy).toHaveBeenCalledWith('rank:alltime:wins', 1, 'acc1');
    // 주간/월간 키도 호출됐는지 확인 (키 이름은 동적)
    const calls = mockRedis.zIncrBy.mock.calls.map((c) => c[0]);
    expect(calls.some((k) => k.startsWith('rank:weekly:'))).toBe(true);
    expect(calls.some((k) => k.startsWith('rank:monthly:'))).toBe(true);
  });

  test('패배 시 wins는 0 증가한다', async () => {
    await recordResult('acc2', '플레이어2', '', false, 10);
    expect(mockRedis.zIncrBy).toHaveBeenCalledWith('rank:alltime:wins', 0, 'acc2');
  });

  test('accountId가 없으면 아무것도 하지 않는다', async () => {
    await recordResult(null, '이름', '', true, 10);
    expect(mockRedis.zIncrBy).not.toHaveBeenCalled();
  });
});

describe('getLeaderboard', () => {
  test('상위 N명을 점수 내림차순으로 반환한다', async () => {
    await recordResult('a1', '유저1', '', true, 50);
    await recordResult('a2', '유저2', '', false, 30);
    await recordResult('a3', '유저3', '', true, 80);

    const board = await getLeaderboard('alltime', 'score', 3);
    expect(board[0].score).toBeGreaterThanOrEqual(board[1].score);
    expect(board[0].rank).toBe(1);
  });

  test('limit을 100으로 제한한다', async () => {
    const board = await getLeaderboard('alltime', 'score', 999);
    // mock은 최대 zRangeWithScores(key, 0, 99) 호출
    expect(mockRedis.zRangeWithScores).toHaveBeenCalledWith(
      expect.any(String), 0, 99, { REV: true }
    );
  });
});

describe('getUserRank', () => {
  test('기록이 있으면 rank와 score를 반환한다', async () => {
    await recordResult('myAcc', '나', '', true, 40);
    const result = await getUserRank('myAcc', 'alltime');
    expect(result.rank).toBe(1);
    expect(result.score).toBe(40);
  });

  test('기록이 없으면 rank: null, score: 0을 반환한다', async () => {
    const result = await getUserRank('unknownAcc', 'alltime');
    expect(result.rank).toBeNull();
    expect(result.score).toBe(0);
  });

  test('accountId가 없으면 rank: null을 반환한다', async () => {
    const result = await getUserRank(null);
    expect(result.rank).toBeNull();
  });
});
