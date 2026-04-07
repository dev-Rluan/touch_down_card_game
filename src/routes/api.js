/**
 * /api 라우터 — 랭킹, 업적, 일일 미션 REST 엔드포인트
 *
 * GET  /api/leaderboard?period=alltime&type=score&limit=20
 * GET  /api/leaderboard/me?period=alltime          (로그인 필요)
 * GET  /api/achievements                           (로그인 필요)
 * GET  /api/achievements/definitions
 * GET  /api/missions                               (로그인 필요)
 * GET  /api/missions/definitions
 */

const express = require('express');
const router = express.Router();
const rankingService = require('../services/rankingService');
const achievementService = require('../services/achievementService');
const dailyMissionService = require('../services/dailyMissionService');

// ── 미들웨어 ──────────────────────────────────────────────────────────────────

function requireLogin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.status(401).json({ error: '로그인이 필요합니다.' });
}

// ── 랭킹 ──────────────────────────────────────────────────────────────────────

/**
 * GET /api/leaderboard
 * Query: period(alltime|weekly|monthly), type(score|wins), limit(1~100)
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const period = ['alltime', 'weekly', 'monthly'].includes(req.query.period)
      ? req.query.period : 'alltime';
    const type = ['score', 'wins'].includes(req.query.type)
      ? req.query.type : 'score';
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const data = await rankingService.getLeaderboard(period, type, limit);
    res.json({ period, type, leaderboard: data });
  } catch (err) {
    console.error('[api/leaderboard]', err);
    res.status(500).json({ error: '랭킹 조회에 실패했습니다.' });
  }
});

/**
 * GET /api/leaderboard/me
 * 현재 로그인 사용자의 랭킹 위치 반환
 */
router.get('/leaderboard/me', requireLogin, async (req, res) => {
  try {
    const period = ['alltime', 'weekly', 'monthly'].includes(req.query.period)
      ? req.query.period : 'alltime';
    const data = await rankingService.getUserRank(req.user.id, period);
    res.json({ period, ...data });
  } catch (err) {
    console.error('[api/leaderboard/me]', err);
    res.status(500).json({ error: '랭킹 조회에 실패했습니다.' });
  }
});

// ── 업적 ──────────────────────────────────────────────────────────────────────

/**
 * GET /api/achievements
 * 로그인 사용자의 업적 현황
 */
router.get('/achievements', requireLogin, async (req, res) => {
  try {
    const data = await achievementService.getAchievements(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[api/achievements]', err);
    res.status(500).json({ error: '업적 조회에 실패했습니다.' });
  }
});

/**
 * GET /api/achievements/definitions
 * 모든 업적 정의 (미로그인도 조회 가능 — 업적 목록 미리보기)
 */
router.get('/achievements/definitions', (req, res) => {
  res.json({ achievements: achievementService.getAllDefinitions() });
});

// ── 일일 미션 ─────────────────────────────────────────────────────────────────

/**
 * GET /api/missions
 * 오늘의 미션 현황 (미로그인 시 진행도 없이 정의만 반환)
 */
router.get('/missions', async (req, res) => {
  try {
    const accountId = req.isAuthenticated?.() ? req.user?.id : null;
    const data = await dailyMissionService.getDailyMissions(accountId);
    res.json(data);
  } catch (err) {
    console.error('[api/missions]', err);
    res.status(500).json({ error: '미션 조회에 실패했습니다.' });
  }
});

/**
 * GET /api/missions/definitions
 */
router.get('/missions/definitions', (req, res) => {
  res.json({ missions: dailyMissionService.getAllDefinitions() });
});

module.exports = router;
