# Stage 1: React 클라이언트 빌드
FROM node:18-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: 프로덕션 이미지
FROM node:18-alpine

LABEL maintainer="dev-Rluan"
LABEL description="Touch Down Card Game - 온라인 할리갈리 멀티플레이어 게임"
LABEL version="2.0.0"

WORKDIR /app

# 백엔드 의존성 설치
COPY package*.json ./
RUN npm ci --omit=dev

# 백엔드 소스 복사
COPY src/ ./src/

# React 빌드 결과물 복사 (client build → src/public/dist)
COPY --from=client-builder /app/src/public/dist ./src/public/dist

# 포트 노출
EXPOSE 3000

# 환경 변수
ENV NODE_ENV=production
ENV PORT=3000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 실행
CMD ["npm", "start"]
