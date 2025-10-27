# 🚀 Koyeb 배포 가이드

Touch Down Card Game을 Koyeb에 무료로 배포하는 방법입니다.

## 📋 Koyeb이란?

- **무료 호스팅**: 무료 플랜으로 시작 가능
- **자동 배포**: GitHub 연동으로 자동 배포
- **글로벌 CDN**: 전 세계 어디서나 빠른 접속
- **WebSocket 지원**: Socket.IO 완벽 지원

## 🎯 배포하면 이렇게 됩니다

```
로컬 개발                    Koyeb 배포
localhost:3000    →    https://your-app.koyeb.app
(혼자만 사용)              (전 세계 누구나 접속 가능!)

                         친구1: your-app.koyeb.app
                         친구2: your-app.koyeb.app
                         친구3: your-app.koyeb.app
                         ↓
                    모두 같은 서버에서 함께 게임!
```

## 📝 사전 준비

1. **GitHub 계정**: 코드가 이미 GitHub에 있어야 함 ✅ (완료)
2. **Koyeb 계정**: [koyeb.com](https://www.koyeb.com) 가입 (무료)

## 🚀 배포 방법

### Step 1: Koyeb 가입 및 로그인

1. [Koyeb](https://www.koyeb.com) 접속
2. "Sign up" 클릭 (GitHub 계정으로 가입 추천)
3. 무료 플랜 선택

### Step 2: 새 앱 생성

1. Koyeb 대시보드에서 **"Create App"** 클릭
2. **"GitHub"** 선택
3. 저장소 연결 승인
4. `touch_down_card_game` 저장소 선택

### Step 3: 배포 설정

#### 기본 설정
- **Branch**: `main`
- **Build method**: `Dockerfile` 선택 (이미 만들어둠! ✅)
- **Port**: `3000`

#### 환경 변수 설정
다음 환경 변수를 추가하세요:

```
NODE_ENV=production
PORT=3000
```

#### 고급 설정 (선택사항)
- **Region**: 가장 가까운 지역 선택 (예: Singapore)
- **Instance type**: Nano (무료 플랜)

### Step 4: 배포!

1. **"Deploy"** 버튼 클릭
2. 3-5분 정도 기다리면 배포 완료
3. 생성된 URL 확인: `https://your-app-name.koyeb.app`

## 🎮 배포 후 사용 방법

### 혼자 테스트
1. 배포된 URL로 접속: `https://your-app.koyeb.app`
2. 닉네임 입력
3. 방 만들기
4. 정상 작동 확인! ✅

### 친구들과 함께
1. 친구들에게 URL 공유: `https://your-app.koyeb.app`
2. 친구들이 같은 URL로 접속
3. 방 목록에서 같은 방 입장
4. 함께 게임 시작! 🎉

## 🔧 설정 확인

### Dockerfile이 이미 준비되어 있습니다!

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
CMD ["npm", "start"]
```

### 클라이언트 자동 연결

`src/public/js/config.js`가 자동으로 Koyeb 서버를 감지합니다:

```javascript
getServerUrl() {
  // Koyeb URL로 접속하면 자동으로 해당 서버에 연결!
  return window.location.origin;
}
```

**별도 설정 필요 없음!** ✨

## 📊 무료 플랜 제한

Koyeb 무료 플랜:
- ✅ **1개 앱** 배포 가능
- ✅ **항상 실행** (sleep 없음)
- ✅ **WebSocket 지원**
- ✅ **Custom domain** 가능
- ⚠️ **512MB RAM** (충분함)
- ⚠️ **2GB Storage**

**이 게임은 무료 플랜으로 충분합니다!** 👍

## 🎯 동시 접속자 수

### 무료 플랜으로 가능한 동시 접속자
- **예상**: 20-50명 정도
- **게임 방**: 여러 방 동시 운영 가능
- **방당 인원**: 최대 8명 (코드에 설정됨)

### 예시
```
[방 1] 4명 게임 중
[방 2] 3명 게임 중
[방 3] 2명 대기 중
[로비] 5명 방 찾는 중
─────────────────
총 14명 동시 접속 → 문제 없음! ✅
```

## 🔍 배포 상태 확인

### Koyeb 대시보드에서
- **Status**: `Healthy` 확인
- **Logs**: 서버 로그 실시간 확인
- **Metrics**: CPU/메모리 사용량 모니터링

### 로그 확인
```
[Server] 서버가 3000번 포트에서 시작되었습니다.
[Socket] 새로운 클라이언트 연결: xyz123
```

## 🐛 문제 해결

### 1. 배포 실패 - "Build Failed"

**원인**: package.json 또는 Dockerfile 문제

**해결**:
```bash
# 로컬에서 Docker 빌드 테스트
docker build -t test .
docker run -p 3000:3000 test

# 문제없으면 Git push
git push origin main
```

### 2. 배포 성공했지만 접속 안됨

**원인**: 포트 설정 문제

**해결**: Koyeb 설정에서
- Port: `3000` 확인
- Protocol: `HTTP` 선택

### 3. WebSocket 연결 실패

**원인**: Koyeb는 WebSocket을 지원하지만 설정 필요

**해결**: Koyeb 지원팀에 문의 (보통 자동으로 작동함)

### 4. 게임 중 끊김

**원인**: 무료 플랜 리소스 부족

**해결**:
- 불필요한 로그 줄이기
- 게임 방 개수 제한
- 또는 유료 플랜 고려

## 🔒 보안 설정

### HTTPS 자동 적용
Koyeb는 자동으로 HTTPS를 제공합니다:
- `http://your-app.koyeb.app` → 자동으로 `https://`로 리다이렉트
- SSL 인증서 자동 관리
- 별도 설정 불필요! ✅

### 환경 변수 보안
민감한 정보는 Koyeb 환경 변수로 설정:
```
# 코드에 직접 작성 ❌
const SECRET_KEY = "my-secret";

# Koyeb 환경 변수로 설정 ✅
const SECRET_KEY = process.env.SECRET_KEY;
```

## 📱 커스텀 도메인 (선택사항)

자신의 도메인을 연결할 수 있습니다:

1. 도메인 구매 (예: `touchdowngame.com`)
2. Koyeb 대시보드 → Settings → Domains
3. 커스텀 도메인 추가
4. DNS 설정 (Koyeb에서 안내)

완료 후:
```
https://touchdowngame.com 으로 접속 가능!
```

## 🔄 자동 배포 (CI/CD)

GitHub에 Push하면 자동으로 배포됩니다:

```bash
# 로컬에서 코드 수정
vim src/server.js

# Git 커밋 & 푸시
git add .
git commit -m "feat: 새로운 기능 추가"
git push origin main

# Koyeb가 자동으로 감지하고 재배포!
# 3-5분 후 새 버전 적용 완료
```

## 💰 비용

### 무료 플랜 (Free)
- **가격**: $0/월
- **앱**: 1개
- **메모리**: 512MB
- **동시 접속**: ~50명
- **이 게임에 충분!** ✅

### Hobby 플랜 (선택사항)
- **가격**: $5/월
- **메모리**: 1GB
- **동시 접속**: ~200명
- 더 많은 플레이어가 필요할 때

## 📈 성능 최적화

### 1. 로깅 최적화
```javascript
// src/server.js
if (process.env.NODE_ENV === 'production') {
  // 프로덕션에서는 중요한 로그만
  console.log = () => {};
  console.debug = () => {};
}
```

### 2. 연결 제한
```javascript
// 동시 접속자 제한 (DDoS 방지)
const MAX_CONNECTIONS = 100;
let currentConnections = 0;

io.on('connection', (socket) => {
  if (currentConnections >= MAX_CONNECTIONS) {
    socket.emit('error', '서버가 혼잡합니다. 잠시 후 다시 시도해주세요.');
    socket.disconnect();
    return;
  }
  currentConnections++;
  
  socket.on('disconnect', () => {
    currentConnections--;
  });
});
```

### 3. 방 개수 제한
```javascript
// src/services/roomService.js
const MAX_ROOMS = 50;

function createRoom(socketId, roomName, maxUserCnt) {
  if (Object.keys(rooms).length >= MAX_ROOMS) {
    throw new Error('생성 가능한 방 개수를 초과했습니다.');
  }
  // ...
}
```

## 🎉 배포 완료 체크리스트

배포 후 다음을 확인하세요:

- [ ] URL 접속 확인: `https://your-app.koyeb.app`
- [ ] 닉네임 설정 작동 확인
- [ ] 방 생성 작동 확인
- [ ] 방 입장 작동 확인
- [ ] 게임 시작 작동 확인
- [ ] 카드 내기 작동 확인
- [ ] 할리갈리 버튼 작동 확인
- [ ] 다른 기기에서 동시 접속 테스트
- [ ] 친구와 멀티플레이 테스트

## 🆘 도움이 필요하면

### Koyeb 공식 문서
- [Koyeb Docs](https://www.koyeb.com/docs)
- [Node.js 배포 가이드](https://www.koyeb.com/docs/deploy/nodejs)

### 커뮤니티
- [Koyeb Discord](https://discord.gg/koyeb)
- [GitHub Issues](https://github.com/dev-Rluan/touch_down_card_game/issues)

## 💡 꿀팁

### 1. URL 짧게 만들기
Koyeb 앱 이름을 짧고 기억하기 쉽게:
```
❌ touch-down-card-game-production-xyz
✅ touchgame
→ https://touchgame.koyeb.app
```

### 2. 로그 모니터링
Koyeb 대시보드에서 실시간 로그 확인:
```bash
[Server] 서버 시작
[Socket] 사용자 연결
[Room] 방 생성
```

### 3. 빠른 롤백
문제 생기면 이전 버전으로 즉시 복구:
- Koyeb 대시보드 → Deployments
- 이전 버전 선택 → "Redeploy"

## 🎊 완료!

이제 전 세계 어디서나 친구들과 함께 게임을 즐길 수 있습니다!

```
URL 공유 → 친구 접속 → 같은 방 입장 → 게임 시작! 🎮
```

---

**더 궁금한 점이 있으면 언제든 물어보세요!** 😊

