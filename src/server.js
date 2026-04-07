// 필요한 모듈들을 가져옵니다.
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.SOCKET_ALLOW_ORIGINS ? process.env.SOCKET_ALLOW_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const cors = require('cors');
const session = require('express-session');
const passport = require('./config/passport');
const { createClient } = require('redis');
const { RedisStore } = require('connect-redis');

// Socket.IO 이벤트 핸들러 초기화
const socketEvent = require('./socket/socketEvent');
const { ensureRedisConnection, redisClient } = require('./config/redisClient');

// 정적 파일을 제공하기 위해 public 폴더를 지정합니다.
app.set('views', __dirname + '/views');
const allowedOrigins = process.env.SOCKET_ALLOW_ORIGINS ? process.env.SOCKET_ALLOW_ORIGINS.split(',') : undefined;

app.use(cors({
  origin: allowedOrigins || true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── 세션 설정 ─────────────────────────────────────────────────────────────────
// SESSION_SECRET: 반드시 운영 환경에서는 강력한 랜덤 문자열로 교체하세요.
const sessionSecret = process.env.SESSION_SECRET || 'touchdown-dev-secret-change-in-production';
const sessionMaxAge = parseInt(process.env.SESSION_MAX_AGE || '604800000', 10); // 기본 7일

const sessionMiddleware = session({
  store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: sessionMaxAge,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
  name: 'tdcg.sid',
});

app.use(sessionMiddleware);

// ── Passport 초기화 ───────────────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());

// ── 라우터 등록 ───────────────────────────────────────────────────────────────
const authRouter = require('./routes/auth');
app.use('/auth', authRouter);

// ── 정적 파일 및 클라이언트 설정 ──────────────────────────────────────────────
app.use('/public', express.static(__dirname + '/public'));

// 클라이언트용 환경 변수 스크립트 제공
app.get('/env.js', (req, res) => {
  const socketUrl = process.env.CLIENT_SOCKET_SERVER_URL || process.env.SOCKET_SERVER_URL || '';
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`window.__TOUCHDOWN_SOCKET_URL__ = ${JSON.stringify(socketUrl)};`);
});

// 루트 페이지를 처리합니다.
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/view/index.html');
});

// ── Socket.IO 세션 공유 ───────────────────────────────────────────────────────
// HTTP 세션을 Socket.IO 핸드셰이크에서도 읽을 수 있도록 미들웨어를 공유합니다.
io.engine.use(sessionMiddleware);
io.engine.use(passport.initialize());
io.engine.use(passport.session());

// Socket.IO 이벤트 핸들러 등록
socketEvent(io);

// ── 서버 시작 ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    await ensureRedisConnection();
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
