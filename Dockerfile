# Node.js 18 LTS 버전 사용
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 애플리케이션 메타데이터
LABEL maintainer="dev-Rluan"
LABEL description="Touch Down Card Game - 온라인 할리갈리 멀티플레이어 게임"
LABEL version="1.0.0"

# package.json과 package-lock.json 복사
COPY package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --only=production

# 애플리케이션 소스 코드 복사
COPY src/ ./src/

# 포트 노출
EXPOSE 3000

# 환경 변수 설정
ENV NODE_ENV=production
ENV PORT=3000

# 헬스체크 설정 (옵션)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 애플리케이션 실행
CMD ["npm", "start"]

