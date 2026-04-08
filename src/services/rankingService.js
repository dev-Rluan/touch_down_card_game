/**
 * rankingService — 글로벌 랭킹 시스템 (Redis Sorted Set 기반)
 *
 * 키 구조:
 *   rank:alltime:score   → Sorted Set (score 기준 전체 랭킹)
 *   rank:alltime:wins    → Sorted Set (승리 수 기준 전체 랭킹)
 *   rank:weekly:{YYYY-WW}:score  → 주간 랭킹 (TTL 14일)
 *   rank:monthly:{YYYY-MM}:score → 월간 랭킹 (TTL 45일)
 *   rank_meta:{accountId}        → 닉네임/아바타 캐시 (Hash)
 *
 * PostgreSQL 도입 시 이 파일만 교체하면 됩니다.
 */

const { ensureRedisConnection } = require('../config/redisClient');

// ── 키 생성 헬퍼 ──────────────────────────────────────────────────────────────

function weekKey(type = 'score') {
  const now = new Date();
  const year = now.getUTCFullYear();
  // ISO 주차 계산
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
  return `rank:weekly:${year}-${String(weekNum).padStart(2, '0')}:${type}`;
}

function monthKey(type = 'score') {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `rank:monthly:${ym}:${type}`;
}

function metaKey(accountId) {
  return `rank_meta:${accountId}`;
}

// ── 내부 ──────────────────────────────────────────────────────────────────────

/**
 * Sorted Set 상위 N명 + 각 메타 정보 조합
 */
async function fetchLeaderboard(redis, setKey, limit) {
  // ZREVRANGEBYSCORE: 높은 점수 순서
  const entries = await redis.zRangeWithScores(setKey, 0, limit - 1, { REV: true });

  const result = await Promise.all(
    entries.map(async ({ value: accountId, score }, index) => {
      const meta = await redis.hGetAll(metaKey(accountId));
      return {
        rank: index + 1,
        accountId,
        displayName: meta.displayName || `User_${accountId}`,
        avatar: meta.avatar || '',
        score: Math.round(score),
      };
    })
  );

  return result;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * 게임 결과 기록 (게임 종료 시 호출)
 * @param {string} accountId
 * @param {string} displayName
 * @param {string} avatar
 * @param {boolean} won
 * @param {number} scoreGained
 */
async function recordResult(accountId, displayName, avatar, won, scoreGained) {
  if (!accountId) return;

  const redis = await ensureRedisConnection();
  const score = scoreGained || 0;
  const winPoint = won ? 1 : 0;

  // 메타 정보 캐시 갱신
  await redis.hSet(metaKey(accountId), { displayName: displayName || '', avatar: avatar || '' });

  // 전체 랭킹
  await redis.zIncrBy('rank:alltime:score', score, accountId);
  await redis.zIncrBy('rank:alltime:wins', winPoint, accountId);

  // 주간 랭킹 (TTL 14일)
  const wKey = weekKey('score');
  await redis.zIncrBy(wKey, score, accountId);
  await redis.expire(wKey, 60 * 60 * 24 * 14);

  // 월간 랭킹 (TTL 45일)
  const mKey = monthKey('score');
  await redis.zIncrBy(mKey, score, accountId);
  await redis.expire(mKey, 60 * 60 * 24 * 45);
}

/**
 * 리더보드 조회
 * @param {'alltime'|'weekly'|'monthly'} period
 * @param {'score'|'wins'} type
 * @param {number} limit
 * @returns {Array} 랭킹 배열
 */
async function getLeaderboard(period = 'alltime', type = 'score', limit = 20) {
  const redis = await ensureRedisConnection();

  let setKey;
  if (period === 'weekly') {
    setKey = weekKey(type);
  } else if (period === 'monthly') {
    setKey = monthKey(type);
  } else {
    setKey = `rank:alltime:${type}`;
  }

  return fetchLeaderboard(redis, setKey, Math.min(limit, 100));
}

/**
 * 특정 사용자의 랭킹 조회
 * @param {string} accountId
 * @param {'alltime'|'weekly'|'monthly'} period
 * @returns {{ rank: number|null, score: number }}
 */
async function getUserRank(accountId, period = 'alltime') {
  if (!accountId) return { rank: null, score: 0 };

  const redis = await ensureRedisConnection();
  const setKey = period === 'weekly' ? weekKey('score')
    : period === 'monthly' ? monthKey('score')
    : 'rank:alltime:score';

  const [rank, score] = await Promise.all([
    redis.zRevRank(setKey, accountId),
    redis.zScore(setKey, accountId),
  ]);

  return {
    rank: rank !== null ? rank + 1 : null,
    score: score !== null ? Math.round(score) : 0,
  };
}

module.exports = { recordResult, getLeaderboard, getUserRank };
