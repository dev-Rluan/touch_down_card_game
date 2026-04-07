/**
 * achievementService — 업적 시스템
 *
 * 키 구조:
 *   ach_progress:{accountId}   → Hash  { achievementId: currentValue }
 *   ach_unlocked:{accountId}   → Set   { achievementId, ... }
 *
 * 업적은 ACHIEVEMENTS 배열에서 중앙 관리합니다.
 * 새 업적 추가 = 배열에 항목 하나만 추가하면 됩니다.
 */

const { ensureRedisConnection } = require('../config/redisClient');

// ── 업적 정의 ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} AchievementDef
 * @property {string} id          - 고유 ID
 * @property {string} title       - 업적 이름
 * @property {string} description - 설명
 * @property {string} icon        - 이모지/아이콘
 * @property {string} stat        - 추적할 통계 키
 * @property {number} threshold   - 달성 기준값
 */

/** @type {AchievementDef[]} */
const ACHIEVEMENTS = [
  // 게임 수
  { id: 'first_game',    title: '첫 발걸음',      description: '첫 번째 게임을 완료했습니다',      icon: '🎮', stat: 'totalGames', threshold: 1   },
  { id: 'games_10',      title: '단골 플레이어',   description: '게임을 10번 완료했습니다',          icon: '🔟', stat: 'totalGames', threshold: 10  },
  { id: 'games_50',      title: '베테랑',          description: '게임을 50번 완료했습니다',          icon: '🏅', stat: 'totalGames', threshold: 50  },
  { id: 'games_100',     title: '할리갈리 마스터', description: '게임을 100번 완료했습니다',         icon: '🏆', stat: 'totalGames', threshold: 100 },
  // 승리
  { id: 'first_win',     title: '첫 승리',         description: '첫 번째 승리를 거뒀습니다',         icon: '🥇', stat: 'totalWins',  threshold: 1   },
  { id: 'wins_10',       title: '연전연승',         description: '10번 승리했습니다',                 icon: '🔥', stat: 'totalWins',  threshold: 10  },
  { id: 'wins_50',       title: '전설의 고수',      description: '50번 승리했습니다',                 icon: '👑', stat: 'totalWins',  threshold: 50  },
  // 벨 클릭 (점수)
  { id: 'score_100',     title: '카드 수집가',      description: '누적 100점을 획득했습니다',         icon: '🃏', stat: 'totalScore', threshold: 100  },
  { id: 'score_500',     title: '카드의 신',        description: '누적 500점을 획득했습니다',         icon: '✨', stat: 'totalScore', threshold: 500  },
  // 벨 링 횟수
  { id: 'bell_10',       title: '벨 애호가',        description: '벨을 10번 성공적으로 눌렀습니다',   icon: '🔔', stat: 'bellRings',  threshold: 10  },
  { id: 'bell_50',       title: '벨 마스터',        description: '벨을 50번 성공적으로 눌렀습니다',   icon: '🛎️', stat: 'bellRings',  threshold: 50  },
];

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

function progressKey(accountId) { return `ach_progress:${accountId}`; }
function unlockedKey(accountId) { return `ach_unlocked:${accountId}`; }

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * 통계 업데이트 후 새로 달성된 업적 반환
 * @param {string} accountId
 * @param {Object} statsDelta - { totalGames, totalWins, totalScore, bellRings } 각 증가분
 * @returns {AchievementDef[]} 이번에 새로 달성된 업적 목록
 */
async function updateAndCheck(accountId, statsDelta) {
  if (!accountId) return [];

  const redis = await ensureRedisConnection();
  const pKey = progressKey(accountId);
  const uKey = unlockedKey(accountId);

  // 증가분 반영
  await Promise.all(
    Object.entries(statsDelta)
      .filter(([, v]) => v > 0)
      .map(([stat, delta]) => redis.hIncrBy(pKey, stat, delta))
  );

  // 현재 진행값 & 이미 달성 목록 조회
  const [progress, unlocked] = await Promise.all([
    redis.hGetAll(pKey),
    redis.sMembers(uKey),
  ]);

  const unlockedSet = new Set(unlocked);
  const newlyUnlocked = [];

  for (const ach of ACHIEVEMENTS) {
    if (unlockedSet.has(ach.id)) continue;
    const current = parseInt(progress[ach.stat] || '0', 10);
    if (current >= ach.threshold) {
      await redis.sAdd(uKey, ach.id);
      newlyUnlocked.push(ach);
    }
  }

  return newlyUnlocked;
}

/**
 * 특정 사용자의 업적 현황 조회
 * @param {string} accountId
 * @returns {{ achievements: Array, stats: Object }}
 */
async function getAchievements(accountId) {
  if (!accountId) return { achievements: [], stats: {} };

  const redis = await ensureRedisConnection();
  const [progress, unlocked] = await Promise.all([
    redis.hGetAll(progressKey(accountId)),
    redis.sMembers(unlockedKey(accountId)),
  ]);

  const unlockedSet = new Set(unlocked);

  const achievements = ACHIEVEMENTS.map((ach) => {
    const current = parseInt(progress[ach.stat] || '0', 10);
    const isUnlocked = unlockedSet.has(ach.id);
    return {
      ...ach,
      current,
      unlocked: isUnlocked,
      progress: Math.min(current / ach.threshold, 1),
    };
  });

  return {
    achievements,
    stats: {
      totalGames: parseInt(progress.totalGames || '0', 10),
      totalWins: parseInt(progress.totalWins || '0', 10),
      totalScore: parseInt(progress.totalScore || '0', 10),
      bellRings: parseInt(progress.bellRings || '0', 10),
    },
  };
}

/**
 * 전체 업적 정의 목록 반환 (클라이언트 초기화용)
 */
function getAllDefinitions() {
  return ACHIEVEMENTS;
}

module.exports = { updateAndCheck, getAchievements, getAllDefinitions };
