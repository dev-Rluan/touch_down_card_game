# 🐳 Docker 실행 가이드

Touch Down Card Game을 Docker로 실행하는 방법을 안내합니다.

## 📋 사전 요구사항

### Docker 설치
- **Windows**: [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
- **macOS**: [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)
- **Linux**: [Docker Engine](https://docs.docker.com/engine/install/)

### Docker 설치 확인
```bash
# Docker 버전 확인
docker --version

# Docker Compose 버전 확인
docker-compose --version
```

## 🚀 빠른 시작

### 방법 1: 간편 스크립트 사용 (초보자 권장)

#### Windows 사용자
```bash
# 서버 시작
docker-start.bat

# 로그 확인
docker-logs.bat

# 서버 중지
docker-stop.bat
```

#### Linux/Mac 사용자
```bash
# 실행 권한 부여 (최초 1회만)
chmod +x docker-start.sh docker-stop.sh docker-logs.sh

# 서버 시작
./docker-start.sh

# 로그 확인
./docker-logs.sh

# 서버 중지
./docker-stop.sh
```

### 방법 2: Docker Compose 직접 사용

직접 Docker Compose 명령어를 사용하는 방법입니다.

```bash
# 1. 프로젝트 디렉토리로 이동
cd touch_down_card_game

# 2. Docker Compose로 실행 (백그라운드)
docker-compose up -d

# 3. 접속
# 브라우저에서 http://localhost:3000 접속

# 4. 로그 확인 (선택사항)
docker-compose logs -f
```

### 방법 3: Docker CLI 직접 사용

Docker CLI를 직접 사용하는 방법입니다.

```bash
# 1. Docker 이미지 빌드
docker build -t touch-down-game:latest .

# 2. 컨테이너 실행
docker run -d \
  -p 3000:3000 \
  --name touch-down-game-server \
  --restart unless-stopped \
  touch-down-game:latest

# 3. 접속
# 브라우저에서 http://localhost:3000 접속

# 4. 로그 확인 (선택사항)
docker logs -f touch-down-game-server
```

## 📊 컨테이너 관리

### 컨테이너 상태 확인
```bash
# 실행 중인 컨테이너 확인
docker ps

# 모든 컨테이너 확인 (중지된 것 포함)
docker ps -a

# 컨테이너 상세 정보
docker inspect touch-down-game-server
```

### 컨테이너 제어

#### Docker Compose 사용 시
```bash
# 시작 (최초 실행)
docker-compose up -d

# 중지
docker-compose stop

# 시작 (재시작)
docker-compose start

# 재시작
docker-compose restart

# 중지 및 삭제
docker-compose down

# 중지, 삭제 및 볼륨까지 제거
docker-compose down -v
```

#### Docker CLI 사용 시
```bash
# 중지
docker stop touch-down-game-server

# 시작
docker start touch-down-game-server

# 재시작
docker restart touch-down-game-server

# 삭제 (중지 후)
docker rm touch-down-game-server

# 강제 삭제 (실행 중이어도)
docker rm -f touch-down-game-server
```

## 📝 로그 확인

### Docker Compose
```bash
# 실시간 로그 확인
docker-compose logs -f

# 마지막 100줄 확인
docker-compose logs --tail=100

# 특정 서비스 로그만 확인
docker-compose logs -f touch-down-game
```

### Docker CLI
```bash
# 실시간 로그 확인
docker logs -f touch-down-game-server

# 마지막 100줄 확인
docker logs --tail=100 touch-down-game-server

# 타임스탬프 포함
docker logs -f -t touch-down-game-server
```

## ⚙️ 환경 변수 설정

### docker-compose.yml 수정
```yaml
services:
  touch-down-game:
    environment:
      - NODE_ENV=production
      - PORT=3000
      - LOG_LEVEL=info
      - MAX_ROOM_COUNT=100
      - MAX_USERS_PER_ROOM=4
```

### Docker CLI 사용
```bash
docker run -d \
  -p 3000:3000 \
  --name touch-down-game-server \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e LOG_LEVEL=info \
  -e MAX_ROOM_COUNT=100 \
  -e MAX_USERS_PER_ROOM=4 \
  touch-down-game:latest
```

### .env 파일 사용
```bash
# .env 파일 생성
cat > .env << EOF
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
MAX_ROOM_COUNT=100
MAX_USERS_PER_ROOM=4
EOF

# .env 파일과 함께 실행
docker run -d \
  -p 3000:3000 \
  --name touch-down-game-server \
  --env-file .env \
  touch-down-game:latest
```

## 🔧 포트 변경

### Docker Compose에서 포트 변경
`docker-compose.yml` 파일 수정:
```yaml
services:
  touch-down-game:
    ports:
      - "8080:3000"  # 호스트포트:컨테이너포트
    environment:
      - PORT=3000    # 컨테이너 내부 포트
```

### Docker CLI에서 포트 변경
```bash
docker run -d \
  -p 8080:3000 \
  --name touch-down-game-server \
  -e PORT=3000 \
  touch-down-game:latest
```

접속: http://localhost:8080

## 🔍 헬스체크

### 헬스체크 상태 확인
```bash
# Docker Compose
docker-compose ps

# Docker CLI
docker ps
docker inspect --format='{{json .State.Health}}' touch-down-game-server | jq
```

### 헬스체크 로그 확인
```bash
docker inspect touch-down-game-server | jq '.[0].State.Health'
```

## 🛠️ 개발 모드

개발 중에는 코드 변경사항을 실시간으로 반영하고 싶을 수 있습니다.

### docker-compose.override.yml 생성
```yaml
version: '3.8'

services:
  touch-down-game:
    volumes:
      - ./src:/app/src
      - /app/node_modules
    environment:
      - NODE_ENV=development
    command: npm run dev
```

### 개발 모드 실행
```bash
# docker-compose.override.yml이 자동으로 적용됨
docker-compose up -d

# 로그 확인
docker-compose logs -f
```

## 🐛 문제 해결

### 컨테이너가 시작되지 않음
```bash
# 로그 확인
docker logs touch-down-game-server

# 컨테이너 내부 접속하여 확인
docker exec -it touch-down-game-server sh

# 내부에서 수동 실행 테스트
node src/server.js
```

### 포트 충돌
```bash
# 포트 사용 확인 (Windows)
netstat -ano | findstr :3000

# 포트 사용 확인 (Linux/Mac)
lsof -i :3000

# 다른 포트로 실행
docker run -d -p 8080:3000 --name touch-down-game-server touch-down-game:latest
```

### 이미지 빌드 실패
```bash
# 캐시 없이 재빌드
docker build --no-cache -t touch-down-game:latest .

# Docker Compose로 재빌드
docker-compose build --no-cache
```

### 연결할 수 없음
```bash
# 컨테이너 상태 확인
docker ps

# 헬스체크 확인
docker inspect touch-down-game-server | grep -A 10 Health

# 네트워크 확인
docker network ls
docker network inspect game-network
```

## 🧹 정리

### 컨테이너 정리
```bash
# 중지된 컨테이너 모두 삭제
docker container prune

# 특정 컨테이너 삭제
docker rm touch-down-game-server
```

### 이미지 정리
```bash
# 사용하지 않는 이미지 모두 삭제
docker image prune -a

# 특정 이미지 삭제
docker rmi touch-down-game:latest
```

### 전체 정리
```bash
# Docker Compose로 생성된 모든 리소스 삭제
docker-compose down -v --rmi all

# 전체 시스템 정리 (주의: 모든 중지된 컨테이너, 사용하지 않는 이미지, 네트워크, 볼륨 삭제)
docker system prune -a --volumes
```

## 🚀 프로덕션 배포

### 이미지 최적화
```dockerfile
# 멀티스테이지 빌드 예시 (필요시 Dockerfile 수정)
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/
CMD ["npm", "start"]
```

### Docker Hub 배포
```bash
# Docker Hub 로그인
docker login

# 이미지 태그 지정
docker tag touch-down-game:latest yourusername/touch-down-game:latest
docker tag touch-down-game:latest yourusername/touch-down-game:1.0.0

# 이미지 푸시
docker push yourusername/touch-down-game:latest
docker push yourusername/touch-down-game:1.0.0
```

### 서버에서 실행
```bash
# 이미지 다운로드
docker pull yourusername/touch-down-game:latest

# 실행
docker run -d \
  -p 80:3000 \
  --name touch-down-game-server \
  --restart always \
  -e NODE_ENV=production \
  yourusername/touch-down-game:latest
```

## 📚 추가 자료

- [Docker 공식 문서](https://docs.docker.com/)
- [Docker Compose 문서](https://docs.docker.com/compose/)
- [Node.js Docker 모범 사례](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
- [프로젝트 README](./README.md)

## 💡 팁

1. **개발 모드**: 볼륨 마운트로 실시간 코드 변경 반영
2. **로그 관리**: `docker logs` 명령어로 디버깅
3. **포트 변경**: 다른 서비스와 충돌 시 포트 매핑 변경
4. **환경 분리**: 개발/스테이징/프로덕션 환경별 docker-compose 파일 관리
5. **정기적인 정리**: 사용하지 않는 컨테이너와 이미지 정리로 디스크 공간 확보

---

**Happy Dockering! 🐳✨**

