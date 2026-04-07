/**
 * Passport.js 전략 설정
 *
 * 환경 변수:
 *   GOOGLE_CLIENT_ID       - Google Cloud Console에서 발급
 *   GOOGLE_CLIENT_SECRET   - Google Cloud Console에서 발급
 *   GOOGLE_CALLBACK_URL    - 기본값: http://localhost:3000/auth/google/callback
 *
 *   KAKAO_CLIENT_ID        - Kakao Developers에서 발급 (REST API 키)
 *   KAKAO_CLIENT_SECRET    - Kakao Developers에서 발급 (선택)
 *   KAKAO_CALLBACK_URL     - 기본값: http://localhost:3000/auth/kakao/callback
 *
 * 키를 아직 발급받지 않았다면 .env.example을 참고해 .env 파일에 설정하세요.
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const KakaoStrategy = require('passport-kakao').Strategy;
const { findOrCreateOAuthUser, getAccountById } = require('../services/oauthUserService');

// ── 세션 직렬화 / 역직렬화 ───────────────────────────────────────────────────

// 세션에는 accountId만 저장 (최소 데이터)
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await getAccountById(id);
    done(null, user || false);
  } catch (err) {
    done(err, false);
  }
});

// ── Google OAuth 2.0 전략 ────────────────────────────────────────────────────

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (googleClientId && googleClientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateOAuthUser('google', profile.id, {
            displayName: profile.displayName,
            email: profile.emails?.[0]?.value || '',
            avatar: profile.photos?.[0]?.value || '',
          });
          done(null, user);
        } catch (err) {
          done(err, false);
        }
      }
    )
  );
  console.log('[Passport] Google OAuth 전략 등록 완료');
} else {
  console.warn(
    '[Passport] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 미설정 → Google 로그인 비활성화'
  );
}

// ── Kakao OAuth 전략 ─────────────────────────────────────────────────────────

const kakaoClientId = process.env.KAKAO_CLIENT_ID;

if (kakaoClientId) {
  passport.use(
    new KakaoStrategy(
      {
        clientID: kakaoClientId,
        clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
        callbackURL:
          process.env.KAKAO_CALLBACK_URL || 'http://localhost:3000/auth/kakao/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateOAuthUser('kakao', String(profile.id), {
            displayName: profile.displayName || profile.username,
            email: profile._json?.kakao_account?.email || '',
            avatar: profile._json?.properties?.profile_image || '',
          });
          done(null, user);
        } catch (err) {
          done(err, false);
        }
      }
    )
  );
  console.log('[Passport] Kakao OAuth 전략 등록 완료');
} else {
  console.warn('[Passport] KAKAO_CLIENT_ID 미설정 → Kakao 로그인 비활성화');
}

module.exports = passport;
