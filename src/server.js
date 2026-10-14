// 필요한 모듈들을 가져옵니다.
const express = require('express');
const compression = require('compression');
const app = express();
const server = require('http').Server(app);
const isProduction = process.env.NODE_ENV === 'production';
// 로그인/랭킹/상점 기능 플래그 (기본 꺼짐 — 임시 닉네임으로 바로 플레이)
const accountsEnabled = process.env.ENABLE_ACCOUNTS === 'true';
// 리버스 프록시(Koyeb, Nginx 등) 뒤에서 HTTPS/클라이언트 IP를 올바르게 인식
app.set('trust proxy', 1);
const io = require('socket.io')(server, {
  // 메시지 1개 최대 크기 (기본 1MB → 32KB). 가장 큰 정상 메시지(피드백 1,000자)도 수 KB 이하
  maxHttpBufferSize: 32 * 1024,
  cors: {
    // 운영에서 SOCKET_ALLOW_ORIGINS 미설정 시 동일 출처만 허용(false), 개발은 모두 허용
    origin: process.env.SOCKET_ALLOW_ORIGINS
      ? process.env.SOCKET_ALLOW_ORIGINS.split(',')
      : (isProduction ? false : '*'),
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const cors = require('cors');
const session = require('express-session');
const passport = accountsEnabled ? require('./config/passport') : null;
const { createClient } = require('redis');
const { RedisStore } = require('connect-redis');
const { resetRuntimeState } = require('./services/startupCleanup');

// Socket.IO 이벤트 핸들러 초기화
const socketEvent = require('./socket/socketEvent');
const { ensureRedisConnection, redisClient } = require('./config/redisClient');

const allowedOrigins = process.env.SOCKET_ALLOW_ORIGINS ? process.env.SOCKET_ALLOW_ORIGINS.split(',') : undefined;

app.use(cors({
  origin: allowedOrigins || true,
  credentials: true
}));

// gzip 압축 (모든 응답에 적용, 1KB 이상만)
app.use(compression({ threshold: 1024 }));

// 기본 보안 헤더
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// 헬스체크 (Redis 연결 상태 포함)
// 호스팅의 헬스체크가 수 초~수십 초마다 호출하므로, Redis PING 결과를 짧게 캐시해
// 종량제 Redis(Upstash 등)의 명령 수를 낭비하지 않는다.
const HEALTH_CACHE_MS = 15000;
let healthCache = { at: 0, ok: false };
app.get('/healthz', async (req, res) => {
  const now = Date.now();
  if (now - healthCache.at > HEALTH_CACHE_MS) {
    try {
      const redis = await ensureRedisConnection();
      await redis.ping();
      healthCache = { at: now, ok: true };
    } catch (err) {
      healthCache = { at: now, ok: false };
    }
  }
  res.status(healthCache.ok ? 200 : 503).json({ status: healthCache.ok ? 'ok' : 'error' });
});

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ── 계정 기능 (ENABLE_ACCOUNTS=true 일 때만 활성화) ──────────────────────────────
// 세션/Passport/로그인/랭킹/상점 라우터는 계정 기능이 꺼져 있으면 등록하지 않는다.
let sessionMiddleware = null;
if (accountsEnabled) {
  // SESSION_SECRET: 운영 환경에서는 반드시 강력한 랜덤 문자열을 지정해야 한다.
  if (isProduction && !process.env.SESSION_SECRET) {
    console.error('[Server] 운영 환경에서 ENABLE_ACCOUNTS=true 인데 SESSION_SECRET 이 없습니다.');
    process.exit(1);
  }
  const sessionSecret = process.env.SESSION_SECRET || 'touchdown-dev-secret-change-in-production';
  const sessionMaxAge = parseInt(process.env.SESSION_MAX_AGE || '604800000', 10); // 기본 7일

  sessionMiddleware = session({
    store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      maxAge: sessionMaxAge,
      sameSite: isProduction ? 'none' : 'lax',
    },
    name: 'tdcg.sid',
  });

  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  app.use('/auth', require('./routes/auth'));
  app.use('/api', require('./routes/api'));
  app.use('/api/shop', require('./routes/shop'));
}

// ── ads.txt (AdSense 승인/수익 인증용) ────────────────────────────────────────
// ADSENSE_PUBLISHER_ID(ca-pub-XXXXXXXXXXXXXXXX)가 설정된 경우에만 제공한다.
// SPA 폴백보다 먼저 등록해야 index.html 이 대신 응답되지 않는다.
app.get('/ads.txt', (req, res) => {
  const match = /^ca-(pub-\d{10,20})$/.exec(process.env.ADSENSE_PUBLISHER_ID || '');
  if (!match) return res.status(404).type('text/plain').send('Not found');
  res.type('text/plain').send(`google.com, ${match[1]}, DIRECT, f08c47fec0942fa0\n`);
});

// ── 운영자 페이지 ─────────────────────────────────────────────────────────────
// ADMIN_TOKEN(없으면 FEEDBACK_ADMIN_TOKEN) 이 설정된 경우에만 열린다: /admin/...?token=<토큰>
function adminAuthorized(req) {
  const expected = process.env.ADMIN_TOKEN || process.env.FEEDBACK_ADMIN_TOKEN || '';
  const given = String(req.query.token || (req.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  const crypto = require('crypto');
  const digest = v => crypto.createHash('sha256').update(v).digest();
  return Boolean(expected) && crypto.timingSafeEqual(digest(given), digest(expected));
}

// 네트워크 지연 분포 (벨 시간 보정 기준을 정하기 위한 관측용)
app.get('/admin/latency', (req, res) => {
  if (!adminAuthorized(req)) return res.status(404).type('text/plain').send('Not found');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.json({ ...require('./utils/latency').summary(), suspiciousBells: require('./utils/bellTiming').suspiciousSummary() });
});

// 피드백 확인 페이지
app.get('/admin/feedback', async (req, res) => {
  if (!adminAuthorized(req)) {
    return res.status(404).type('text/plain').send('Not found');
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  try {
    const { listFeedback, CATEGORIES } = require('./utils/feedback');
    const items = await listFeedback(Math.min(Number(req.query.limit) || 200, 1000));
    if (req.query.format === 'json') return res.json(items);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const rows = items.map(f => `<li><div class="m"><b>${esc(CATEGORIES[f.category] || f.category)}</b> · ${esc(f.name || '익명')} · ${esc(new Date(f.ts).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }))}</div><p>${esc(f.text)}</p><div class="ua">${esc(f.ua)}</div></li>`).join('');
    res.type('html').send(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>피드백 ${items.length}건</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:16px;background:#0f2a22;color:#f3efe3}ul{list-style:none;padding:0}li{background:#17382d;border-radius:10px;padding:12px 14px;margin:10px 0}.m{font-size:13px;color:#c9c3b2}b{color:#f0b429}p{white-space:pre-wrap;margin:6px 0;line-height:1.5}.ua{font-size:11px;color:#8a8576;overflow-wrap:anywhere}</style></head>
<body><h1>피드백 ${items.length}건</h1><ul>${rows || '<li>아직 없습니다.</li>'}</ul></body></html>`);
  } catch (err) {
    console.error('[admin/feedback]', err);
    res.status(500).type('text/plain').send('Error');
  }
});

// ── 정적 파일 및 클라이언트 설정 ──────────────────────────────────────────────
// 정적 파일: 7일 브라우저 캐싱 (JS/CSS 변경 시 파일명에 버전 포함 권장)
app.use('/public', express.static(__dirname + '/public', {
  maxAge: '7d',
  etag: true,
  lastModified: true,
}));

// 클라이언트용 환경 변수 스크립트 제공
app.get('/env.js', (req, res) => {
  const socketUrl = process.env.CLIENT_SOCKET_SERVER_URL || process.env.SOCKET_SERVER_URL || '';
  const adsenseId = process.env.ADSENSE_PUBLISHER_ID || '';
  const adsenseLobbySlot = process.env.ADSENSE_LOBBY_SLOT || '';
  const adsenseGameEndSlot = process.env.ADSENSE_GAME_END_SLOT || '';
  const tossClientKey = process.env.TOSS_CLIENT_KEY || '';
  res.setHeader('Content-Type', 'application/javascript');
  // 환경변수는 서버 재시작 없이 바뀌지 않으므로 1시간 캐싱
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send([
    `window.__TOUCHDOWN_SOCKET_URL__ = ${JSON.stringify(socketUrl)};`,
    `window.__ADSENSE_PUBLISHER_ID__ = ${JSON.stringify(adsenseId)};`,
    `window.__ADSENSE_LOBBY_SLOT__ = ${JSON.stringify(adsenseLobbySlot)};`,
    `window.__ADSENSE_GAME_END_SLOT__ = ${JSON.stringify(adsenseGameEndSlot)};`,
    `window.__TOSS_CLIENT_KEY__ = ${JSON.stringify(tossClientKey)};`,
  ].join('\n'));
});

// ── 프론트엔드 서빙 ─────────────────────────────────────────────────────────
// 프로덕션: React 빌드 결과물(client/dist → src/public/dist) 서빙
// 개발: Vite dev server(port 5173)가 담당 — 이 블록은 dist 폴더가 있을 때만 활성화
const fs = require('fs');
const path = require('path');
const clientDist = path.join(__dirname, 'public/dist');

if (fs.existsSync(clientDist)) {
  // 해시가 붙은 빌드 산출물(/assets/*)은 내용이 바뀌면 파일명도 바뀌므로 1년 immutable 캐시,
  // index.html 은 배포 직후 새 해시 파일을 바로 참조하도록 항상 재검증한다.
  app.use(express.static(clientDist, {
    etag: true,
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));
  // SPA fallback — API/auth/socket 이외의 경로는 index.html 응답
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/auth') ||
      req.path.startsWith('/socket.io') ||
      req.path.startsWith('/public') ||
      req.path === '/env.js' ||
      req.path === '/ads.txt' ||
      req.path.startsWith('/admin')
    ) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── Socket.IO 세션 공유 ───────────────────────────────────────────────────────
// HTTP 세션을 Socket.IO 핸드셰이크에서도 읽을 수 있도록 미들웨어를 공유합니다.
if (accountsEnabled) {
  io.engine.use(sessionMiddleware);
  io.engine.use(passport.initialize());
  io.engine.use(passport.session());
}

// IP당 동시 연결 수 제한 (한 컴퓨터에서 연결을 대량으로 열어 서버·Redis 를 채우는 것 방지)
require('./socket/connectionLimit')(io, { maxPerIp: process.env.MAX_CONN_PER_IP !== undefined ? Number(process.env.MAX_CONN_PER_IP) : 10 });

// Socket.IO 이벤트 핸들러 등록
socketEvent(io);

// ── 서버 시작 ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    // 비밀번호 오류 등으로 Redis 에 붙지 못하면 node-redis 는 에러 없이 재시도만 반복한다.
    // 컨테이너가 "실행 중"처럼 보이는 채로 멈추지 않도록, 제한 시간 안에 못 붙으면 종료해
    // 호스팅/Docker 의 자동 재시작과 알림이 동작하게 한다.
    const connectTimeoutMs = parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS || '20000', 10);
    let timer;
    await Promise.race([
      ensureRedisConnection(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Redis 연결 시간 초과 (${connectTimeoutMs}ms) — REDIS_URL/비밀번호를 확인하세요`)), connectTimeoutMs);
      }),
    ]).finally(() => clearTimeout(timer));
    // 이전 프로세스가 남긴 방/유저 데이터 정리 (재배포 후 유령 방 방지)
    await resetRuntimeState();
    server.listen(PORT, () => {
      console.log(`[Server] 서버가 ${PORT}번 포트에서 시작되었습니다.`);
      console.log(`[Server] 접속 URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[Server] Redis 초기화 실패', error);
    process.exit(1);
  }
}

bootstrap();
