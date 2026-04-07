/**
 * oauthUserService 테스트
 * Redis는 mock으로 처리합니다.
 */

// ── Redis mock ────────────────────────────────────────────────────────────────
const mockStore = {};
let mockSeq = 0;

const mockRedis = {
  get: jest.fn(async (key) => mockStore[key] ?? null),
  set: jest.fn(async (key, value) => { mockStore[key] = String(value); }),
  hSet: jest.fn(async (key, ...args) => {
    if (!mockStore[key] || typeof mockStore[key] !== 'object') mockStore[key] = {};
    // hSet(key, { field: value, ... }) 또는 hSet(key, field, value)
    if (typeof args[0] === 'object') {
      Object.assign(mockStore[key], args[0]);
    } else {
      mockStore[key][args[0]] = args[1];
    }
  }),
  hGetAll: jest.fn(async (key) => (typeof mockStore[key] === 'object' ? mockStore[key] : {})),
  hIncrBy: jest.fn(async (key, field, increment) => {
    if (!mockStore[key] || typeof mockStore[key] !== 'object') mockStore[key] = {};
    const current = parseInt(mockStore[key][field] || '0', 10);
    const next = current + increment;
    mockStore[key][field] = String(next);
    return next;
  }),
  incr: jest.fn(async () => ++mockSeq),
};

jest.mock('../../config/redisClient', () => ({
  ensureRedisConnection: jest.fn().mockResolvedValue(mockRedis),
}));

// ── 실제 import는 mock 이후에 ────────────────────────────────────────────────
const {
  findOrCreateOAuthUser,
  getAccountById,
  recordGameResult,
  updateDisplayName,
} = require('../../services/oauthUserService');

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────
function makeProfile(overrides = {}) {
  return { displayName: '테스트유저', email: 'test@example.com', avatar: '', ...overrides };
}

beforeEach(() => {
  // 각 테스트 전 store 초기화
  Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  mockSeq = 0;
  jest.clearAllMocks();
});

// ── findOrCreateOAuthUser ─────────────────────────────────────────────────────
describe('findOrCreateOAuthUser', () => {
  test('신규 사용자를 생성하고 반환한다', async () => {
    const user = await findOrCreateOAuthUser('google', 'google-uid-1', makeProfile());

    expect(user).not.toBeNull();
    expect(user.provider).toBe('google');
    expect(user.displayName).toBe('테스트유저');
    expect(user.email).toBe('test@example.com');
    expect(user.totalWins).toBe(0);
    expect(user.totalGames).toBe(0);
  });

  test('같은 provider+providerId로 재접속 시 기존 사용자를 반환한다', async () => {
    const first = await findOrCreateOAuthUser('google', 'google-uid-1', makeProfile());
    const second = await findOrCreateOAuthUser('google', 'google-uid-1', makeProfile({ displayName: '다른이름' }));

    expect(first.id).toBe(second.id);
    // 재접속 시 displayName은 덮어쓰지 않음 (lastLoginAt만 갱신)
    expect(second.displayName).toBe('테스트유저');
  });

  test('provider가 다르면 별개의 계정을 생성한다', async () => {
    const google = await findOrCreateOAuthUser('google', 'uid-1', makeProfile({ displayName: '구글유저' }));
    const kakao = await findOrCreateOAuthUser('kakao', 'uid-1', makeProfile({ displayName: '카카오유저' }));

    expect(google.id).not.toBe(kakao.id);
    expect(google.provider).toBe('google');
    expect(kakao.provider).toBe('kakao');
  });
});

// ── getAccountById ────────────────────────────────────────────────────────────
describe('getAccountById', () => {
  test('존재하는 계정을 반환한다', async () => {
    const created = await findOrCreateOAuthUser('kakao', 'kakao-1', makeProfile());
    const fetched = await getAccountById(created.id);

    expect(fetched).not.toBeNull();
    expect(fetched.id).toBe(created.id);
  });

  test('존재하지 않는 ID는 null을 반환한다', async () => {
    const result = await getAccountById('999');
    expect(result).toBeNull();
  });
});

// ── recordGameResult ──────────────────────────────────────────────────────────
describe('recordGameResult', () => {
  test('승리 시 totalWins, totalGames, totalScore가 증가한다', async () => {
    const user = await findOrCreateOAuthUser('google', 'g-1', makeProfile());
    await recordGameResult(user.id, true, 10);
    const updated = await getAccountById(user.id);

    expect(updated.totalWins).toBe(1);
    expect(updated.totalGames).toBe(1);
    expect(updated.totalScore).toBe(10);
  });

  test('패배 시 totalWins는 증가하지 않는다', async () => {
    const user = await findOrCreateOAuthUser('google', 'g-2', makeProfile());
    await recordGameResult(user.id, false, 3);
    const updated = await getAccountById(user.id);

    expect(updated.totalWins).toBe(0);
    expect(updated.totalGames).toBe(1);
    expect(updated.totalScore).toBe(3);
  });

  test('accountId가 null이면 아무 것도 하지 않는다', async () => {
    await expect(recordGameResult(null, true, 5)).resolves.not.toThrow();
  });
});

// ── updateDisplayName ─────────────────────────────────────────────────────────
describe('updateDisplayName', () => {
  test('닉네임을 변경한다', async () => {
    const user = await findOrCreateOAuthUser('google', 'g-3', makeProfile());
    await updateDisplayName(user.id, '새닉네임');
    const updated = await getAccountById(user.id);

    expect(updated.displayName).toBe('새닉네임');
  });

  test('빈 값이면 변경하지 않는다', async () => {
    const user = await findOrCreateOAuthUser('google', 'g-4', makeProfile({ displayName: '원래닉네임' }));
    await updateDisplayName(user.id, '   ');
    const updated = await getAccountById(user.id);

    expect(updated.displayName).toBe('원래닉네임');
  });

  test('accountId가 없으면 아무 것도 하지 않는다', async () => {
    await expect(updateDisplayName(null, '닉네임')).resolves.not.toThrow();
  });
});
