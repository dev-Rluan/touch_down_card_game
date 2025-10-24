# 배포 가이드 (Deployment Guide)

## 🚀 배포 개요

이 문서는 Touch Down Card Game 프로젝트의 배포 방법을 안내합니다.

## 📋 배포 전 준비사항

### 1. 환경 요구사항
- **Node.js**: 18.0.0 이상
- **npm**: 8.0.0 이상
- **메모리**: 최소 512MB
- **디스크**: 최소 1GB

### 2. 의존성 확인
```bash
# Node.js 버전 확인
node --version

# npm 버전 확인
npm --version

# 프로젝트 의존성 설치
npm ci --only=production
```

## 🔧 환경별 설정

### 1. 개발 환경 (Development)

#### 환경 변수
```bash
# .env.development
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
```

#### 실행 명령어
```bash
# 개발 서버 시작
npm run dev

# 또는
nodemon src/server.js
```

### 2. 스테이징 환경 (Staging)

#### 환경 변수
```bash
# .env.staging
NODE_ENV=staging
PORT=3000
LOG_LEVEL=info
```

#### 실행 명령어
```bash
# 스테이징 서버 시작
NODE_ENV=staging npm start
```

### 3. 프로덕션 환경 (Production)

#### 환경 변수
```bash
# .env.production
NODE_ENV=production
PORT=3000
LOG_LEVEL=error
```

#### 실행 명령어
```bash
# 프로덕션 서버 시작
NODE_ENV=production npm start
```

## 🐳 Docker 배포

### 1. Dockerfile 작성
```dockerfile
# Dockerfile
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --only=production && npm cache clean --force

# 소스 코드 복사
COPY . .

# 사용자 생성 (보안)
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# 포트 노출
EXPOSE 3000

# 헬스체크 추가
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# 애플리케이션 시작
CMD ["npm", "start"]
```

### 2. Docker Compose 설정
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - app
    restart: unless-stopped
```

### 3. Docker 배포 명령어
```bash
# 이미지 빌드
docker build -t touch-down-game .

# 컨테이너 실행
docker run -d -p 3000:3000 --name touch-down-game touch-down-game

# Docker Compose 사용
docker-compose up -d
```

## ☁️ 클라우드 배포

### 1. AWS EC2 배포

#### EC2 인스턴스 설정
```bash
# Ubuntu 20.04 LTS 사용
sudo apt update
sudo apt install -y nodejs npm git

# Node.js 18 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 프로젝트 클론
git clone https://github.com/your-username/touch_down_card_game.git
cd touch_down_card_game

# 의존성 설치
npm ci --only=production

# PM2로 프로세스 관리
sudo npm install -g pm2
pm2 start src/server.js --name "touch-down-game"
pm2 startup
pm2 save
```

#### Nginx 설정
```nginx
# /etc/nginx/sites-available/touch-down-game
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. Heroku 배포

#### Procfile 생성
```
web: npm start
```

#### package.json 수정
```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "engines": {
    "node": "18.x"
  }
}
```

#### Heroku 배포 명령어
```bash
# Heroku CLI 설치 후
heroku create touch-down-game
git push heroku main
heroku open
```

### 3. Vercel 배포

#### vercel.json 설정
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/server.js"
    }
  ]
}
```

#### Vercel 배포 명령어
```bash
# Vercel CLI 설치 후
vercel
vercel --prod
```

## 🔍 모니터링 및 로깅

### 1. 로깅 설정
```javascript
// utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

### 2. PM2 모니터링
```bash
# PM2 상태 확인
pm2 status

# 로그 확인
pm2 logs touch-down-game

# 모니터링 대시보드
pm2 monit
```

### 3. 헬스체크 엔드포인트
```javascript
// src/server.js에 추가
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});
```

## 🔒 보안 설정

### 1. 환경 변수 보안
```bash
# .env 파일을 .gitignore에 추가
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo ".env.production" >> .gitignore
```

### 2. 방화벽 설정
```bash
# UFW 방화벽 설정 (Ubuntu)
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 3. SSL 인증서 설정
```bash
# Let's Encrypt 인증서 설치
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 📊 성능 최적화

### 1. Node.js 최적화
```bash
# Node.js 옵션 설정
export NODE_OPTIONS="--max-old-space-size=512"
export UV_THREADPOOL_SIZE=4
```

### 2. PM2 클러스터 모드
```bash
# PM2 클러스터 모드로 실행
pm2 start src/server.js -i max --name "touch-down-game"
```

### 3. Nginx 최적화
```nginx
# nginx.conf 최적화
worker_processes auto;
worker_connections 1024;

# Gzip 압축
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

# 캐싱 설정
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 🚨 문제 해결

### 1. 일반적인 문제들

#### 포트 충돌
```bash
# 포트 사용 중인 프로세스 확인
lsof -i :3000

# 프로세스 종료
kill -9 PID
```

#### 메모리 부족
```bash
# 메모리 사용량 확인
free -h
ps aux --sort=-%mem | head

# Node.js 메모리 제한 설정
node --max-old-space-size=512 src/server.js
```

#### 연결 문제
```bash
# 방화벽 상태 확인
sudo ufw status

# 포트 열기
sudo ufw allow 3000
```

### 2. 로그 확인
```bash
# 애플리케이션 로그
tail -f logs/combined.log
tail -f logs/error.log

# PM2 로그
pm2 logs touch-down-game

# 시스템 로그
sudo journalctl -u your-service-name
```

## 📈 배포 자동화

### 1. GitHub Actions CI/CD
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Deploy to server
        run: |
          # 배포 스크립트 실행
          ./scripts/deploy.sh
```

### 2. 배포 스크립트
```bash
#!/bin/bash
# scripts/deploy.sh

echo "🚀 배포 시작..."

# 서버에 접속하여 배포
ssh user@your-server.com << 'EOF'
  cd /path/to/touch_down_card_game
  git pull origin main
  npm ci --only=production
  pm2 restart touch-down-game
  echo "✅ 배포 완료"
EOF

echo "🎉 배포 완료!"
```

## 📋 배포 체크리스트

### 배포 전 확인사항
- [ ] 모든 테스트 통과
- [ ] 환경 변수 설정 완료
- [ ] 데이터베이스 연결 확인
- [ ] 로그 디렉토리 생성
- [ ] 방화벽 설정 확인
- [ ] SSL 인증서 설정
- [ ] 모니터링 도구 설정

### 배포 후 확인사항
- [ ] 애플리케이션 정상 실행
- [ ] 헬스체크 엔드포인트 응답
- [ ] 로그 정상 생성
- [ ] 성능 모니터링 정상
- [ ] 보안 설정 확인

이 가이드를 따라 배포하면 안정적이고 확장 가능한 서비스를 운영할 수 있습니다! 🚀
