#!/bin/bash
# Touch Down Card Game - Docker 로그 확인 스크립트
# Linux/Mac 사용자를 위한 간단한 로그 확인 스크립트

echo "================================"
echo "Touch Down Card Game"
echo "Docker 로그 확인"
echo "================================"
echo ""
echo "Ctrl+C를 눌러 종료할 수 있습니다."
echo ""

# Docker Compose 설치 확인
if ! command -v docker-compose &> /dev/null; then
    echo "[오류] Docker Compose가 설치되어 있지 않습니다."
    exit 1
fi

# 로그 실시간 확인
docker-compose logs -f

