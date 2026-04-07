/**
 * OAuth 인증 라우터
 *
 * 엔드포인트:
 *   GET /auth/google               - Google 로그인 시작
 *   GET /auth/google/callback      - Google 콜백
 *   GET /auth/kakao                - Kakao 로그인 시작
 *   GET /auth/kakao/callback       - Kakao 콜백
 *   GET /auth/logout               - 로그아웃
 *   GET /auth/me                   - 현재 로그인 사용자 정보 (JSON)
 *   PATCH /auth/me/name            - 닉네임 변경
 */

const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const { updateDisplayName } = require('../services/oauthUserService');

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

/**
 * 전략이 등록됐는지 확인하고, 미등록 시 503 반환
 */
function requireStrategy(strategyName) {
  return (req, res, next) => {
    try {
      passport._strategy(strategyName);
      next();
    } catch {
      res.status(503).json({
        error: `${strategyName} 로그인이 현재 비활성화 상태입니다. 관리자에게 문의하세요.`,
      });
    }
  };
}

// ── Google ────────────────────────────────────────────────────────────────────

router.get(
  '/google',
  requireStrategy('google'),
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  requireStrategy('google'),
  passport.authenticate('google', { failureRedirect: '/?auth_error=google' }),
  (req, res) => {
    res.redirect('/?auth_success=1');
  }
);

// ── Kakao ─────────────────────────────────────────────────────────────────────

router.get(
  '/kakao',
  requireStrategy('kakao'),
  passport.authenticate('kakao')
);

router.get(
  '/kakao/callback',
  requireStrategy('kakao'),
  passport.authenticate('kakao', { failureRedirect: '/?auth_error=kakao' }),
  (req, res) => {
    res.redirect('/?auth_success=1');
  }
);

// ── 공통 ──────────────────────────────────────────────────────────────────────

/**
 * GET /auth/me
 * 현재 세션의 사용자 정보를 반환합니다.
 * 미로그인 시 { loggedIn: false } 반환 (401 아님 — 게스트 지원)
 */
router.get('/me', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.json({ loggedIn: false });
  }
  const { id, provider, displayName, email, avatar, totalWins, totalGames, totalScore } = req.user;
  res.json({
    loggedIn: true,
    user: { id, provider, displayName, email, avatar, totalWins, totalGames, totalScore },
  });
});

/**
 * PATCH /auth/me/name
 * 로그인한 사용자의 닉네임을 변경합니다.
 * Body: { name: "새닉네임" }
 */
router.patch('/me/name', async (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  const newName = req.body?.name?.trim();
  if (!newName || newName.length < 2 || newName.length > 20) {
    return res.status(400).json({ error: '닉네임은 2~20자여야 합니다.' });
  }

  try {
    await updateDisplayName(req.user.id, newName);
    // 세션의 user 정보도 갱신
    req.user.displayName = newName;
    res.json({ success: true, displayName: newName });
  } catch (err) {
    console.error('[auth/me/name]', err);
    res.status(500).json({ error: '닉네임 변경에 실패했습니다.' });
  }
});

/**
 * GET /auth/logout
 */
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

/**
 * 활성화된 OAuth 제공자 목록 반환 (프론트에서 버튼 표시 여부 결정에 사용)
 * GET /auth/providers
 */
router.get('/providers', (req, res) => {
  const providers = [];
  try { passport._strategy('google'); providers.push('google'); } catch {}
  try { passport._strategy('kakao'); providers.push('kakao'); } catch {}
  res.json({ providers });
});

module.exports = router;
