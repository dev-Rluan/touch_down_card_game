/**
 * OAuth 사용자 관리 서비스 (Redis 기반)
 *
 * 키 구조:
 *   oauth_user:{provider}:{providerId}  → accountId (문자열)
 *   account:{accountId}                 → 사용자 정보 (Hash)
 *   account_seq                         → 자동증가 accountId 카운터
 *
 * PostgreSQL 도입 시 이 파일만 교체하면 됩니다.
 */

const { ensureRedisConnection } = require('../config/redisClient');

const OAUTH_LINK_PREFIX = 'oauth_user:';
const ACCOUNT_PREFIX = 'account:';
const ACCOUNT_SEQ_KEY = 'account_seq';

// ── 내부 헬퍼 ────────────────────────────────────────────────────────────────

function oauthLinkKey(provider, providerId) {
  return `${OAUTH_LINK_PREFIX}${provider}:${providerId}`;
}

function accountKey(accountId) {
  return `${ACCOUNT_PREFIX}${accountId}`;
}

async function nextAccountId(redis) {
  return String(await redis.incr(ACCOUNT_SEQ_KEY));
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * OAuth 로그인 시 사용자 조회 또는 신규 생성 (upsert)
 * @param {string} provider   - 'google' | 'kakao'
 * @param {string} providerId - OAuth 제공자가 발급한 고유 ID
 * @param {Object} profile    - { displayName, email, avatar }
 * @returns {Object} 사용자 계정 정보
 */
async function findOrCreateOAuthUser(provider, providerId, profile) {
  const redis = await ensureRedisConnection();
  const linkKey = oauthLinkKey(provider, providerId);

  let accountId = await redis.get(linkKey);

  if (!accountId) {
    // 신규 가입
    accountId = await nextAccountId(redis);
    const now = new Date().toISOString();

    await redis.set(linkKey, accountId);
    await redis.hSet(accountKey(accountId), {
      id: accountId,
      provider,
      providerId,
      displayName: profile.displayName || `User_${accountId}`,
      email: profile.email || '',
      avatar: profile.avatar || '',
      createdAt: now,
      lastLoginAt: now,
      totalWins: '0',
      totalGames: '0',
      totalScore: '0',
    });
  } else {
    // 기존 사용자 — 마지막 로그인 시각 갱신
    await redis.hSet(accountKey(accountId), {
      lastLoginAt: new Date().toISOString(),
    });
  }

  return getAccountById(accountId);
}

/**
 * accountId로 사용자 조회
 * @param {string} accountId
 * @returns {Object|null}
 */
async function getAccountById(accountId) {
  const redis = await ensureRedisConnection();
  const data = await redis.hGetAll(accountKey(accountId));
  if (!data || !data.id) return null;

  return {
    id: data.id,
    provider: data.provider,
    displayName: data.displayName,
    email: data.email,
    avatar: data.avatar,
    createdAt: data.createdAt,
    lastLoginAt: data.lastLoginAt,
    totalWins: Number(data.totalWins) || 0,
    totalGames: Number(data.totalGames) || 0,
    totalScore: Number(data.totalScore) || 0,
  };
}

/**
 * 게임 결과 기록 업데이트 (게임 종료 시 호출)
 * @param {string} accountId
 * @param {boolean} won        - 승리 여부
 * @param {number} scoreGained - 이번 게임 획득 점수
 */
async function recordGameResult(accountId, won, scoreGained) {
  if (!accountId) return;
  const redis = await ensureRedisConnection();
  const key = accountKey(accountId);

  await redis.hIncrBy(key, 'totalGames', 1);
  await redis.hIncrBy(key, 'totalScore', scoreGained || 0);
  if (won) {
    await redis.hIncrBy(key, 'totalWins', 1);
  }
}

/**
 * 닉네임(displayName) 변경
 * @param {string} accountId
 * @param {string} newName
 */
async function updateDisplayName(accountId, newName) {
  if (!accountId || !newName?.trim()) return;
  const redis = await ensureRedisConnection();
  await redis.hSet(accountKey(accountId), 'displayName', newName.trim());
}

module.exports = {
  findOrCreateOAuthUser,
  getAccountById,
  recordGameResult,
  updateDisplayName,
};
