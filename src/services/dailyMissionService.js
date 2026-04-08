/**
 * dailyMissionService — 일일 미션 시스템
 *
 * 키 구조:
 *   daily_mission:{accountId}:{YYYY-MM-DD}  → Hash
 *     { missionId: currentProgress, ... }
 *   daily_completed:{accountId}:{YYYY-MM-DD} → Set
 *     { missionId, ... }
 *
 * 미션 키에 자정까지 남은 시간(TTL)을 설정해 자동으로 초기화됩니다.
 */

const { ensureRedisConnection } = require('../config/redisClient');

// ── 미션 정의 ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} MissionDef
 * @property {string} id          - 고유 ID
 * @property {string} title       - 미션 이름
 * @property {string} description - 설명
 * @property {string} icon        - 이모지
 * @property {string} stat        - 추적 통계
 * @property {number} goal        - 목표값
 * @property {string} reward      - 보상 설명 (추후 코인/XP 연동)
 */

/** @type {MissionDef[]} */
const DAILY_MISSIONS = [
  { id: 'play_1',  title: '워밍업',        description: '오늘 게임 1판 플레이',           icon: '🎯', stat: 'gamesPlayed',  goal: 1,  reward: 'XP +50'   },
  { id: 'play_3',  title: '열정 플레이어', description: '오늘 게임 3판 플레이',           icon: '🕹️', stat: 'gamesPlayed',  goal: 3,  reward: 'XP +150'  },
  { id: 'win_1',   title: '오늘의 승자',   description: '오늘 1판 승리',                  icon: '🥇', stat: 'wins',         goal: 1,  reward: 'XP +100'  },
  { id: 'win_2',   title: '연승 도전',     description: '오늘 2판 승리',                  icon: '🔥', stat: 'wins',         goal: 2,  reward: 'XP +200'  },
  { id: 'bell_3',  title: '벨 타이밍',    description: '오늘 벨 3번 성공',               icon: '🔔', stat: 'bellSuccess',  goal: 3,  reward: 'XP +75'   },
  { id: 'score_30',title: '카드 수집',     description: '오늘 30점 이상 획득',            icon: '🃏', stat: 'scoreEarned',  goal: 30, reward: 'XP +120'  },
];

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

function todayString() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function progressKey(accountId, date) {
  return `daily_mission:${accountId}:${date}`;
}

function completedKey(accountId, date) {
  return `daily_completed:${accountId}:${date}`;
}

/** 오늘 자정(UTC)까지 남은 초 */
function secondsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.ceil((midnight - now) / 1000);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * 일일 미션 진행 업데이트 후 새로 완료된 미션 반환
 * @param {string} accountId
 * @param {Object} statsDelta - { gamesPlayed, wins, bellSuccess, scoreEarned }
 * @returns {MissionDef[]} 이번에 새로 완료된 미션 목록
 */
async function updateAndCheck(accountId, statsDelta) {
  if (!accountId) return [];

  const redis = await ensureRedisConnection();
  const date = todayString();
  const pKey = progressKey(accountId, date);
  const cKey = completedKey(accountId, date);
  const ttl = secondsUntilMidnight();

  // 진행값 증가
  await Promise.all(
    Object.entries(statsDelta)
      .filter(([, v]) => v > 0)
      .map(([stat, delta]) => redis.hIncrBy(pKey, stat, delta))
  );
  // TTL 설정 (자정에 자동 만료)
  await redis.expire(pKey, ttl);

  // 현재 진행 & 이미 완료 목록
  const [progress, completed] = await Promise.all([
    redis.hGetAll(pKey),
    redis.sMembers(cKey),
  ]);

  const completedSet = new Set(completed);
  const newlyCompleted = [];

  for (const mission of DAILY_MISSIONS) {
    if (completedSet.has(mission.id)) continue;
    const current = parseInt(progress[mission.stat] || '0', 10);
    if (current >= mission.goal) {
      await redis.sAdd(cKey, mission.id);
      await redis.expire(cKey, ttl);
      newlyCompleted.push(mission);
    }
  }

  return newlyCompleted;
}

/**
 * 오늘의 일일 미션 현황 조회
 * @param {string} accountId
 * @returns {{ missions: Array, completedCount: number, totalCount: number }}
 */
async function getDailyMissions(accountId) {
  if (!accountId) {
    return {
      missions: DAILY_MISSIONS.map((m) => ({ ...m, current: 0, completed: false })),
      completedCount: 0,
      totalCount: DAILY_MISSIONS.length,
    };
  }

  const redis = await ensureRedisConnection();
  const date = todayString();
  const [progress, completed] = await Promise.all([
    redis.hGetAll(progressKey(accountId, date)),
    redis.sMembers(completedKey(accountId, date)),
  ]);

  const completedSet = new Set(completed);

  const missions = DAILY_MISSIONS.map((mission) => ({
    ...mission,
    current: parseInt(progress[mission.stat] || '0', 10),
    completed: completedSet.has(mission.id),
  }));

  return {
    missions,
    completedCount: completedSet.size,
    totalCount: DAILY_MISSIONS.length,
    date,
  };
}

/**
 * 미션 정의만 반환 (클라이언트 초기화용)
 */
function getAllDefinitions() {
  return DAILY_MISSIONS;
}

module.exports = { updateAndCheck, getDailyMissions, getAllDefinitions };
