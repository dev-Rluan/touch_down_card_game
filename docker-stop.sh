#!/bin/bash
# Touch Down Card Game - Docker 중지 스크립트
# Linux/Mac 사용자를 위한 간단한 중지 스크립트

echo "================================"
echo "Touch Down Card Game"
echo "Docker 중지 스크립트"
echo "================================"
echo ""

# Docker Compose 설치 확인
if ! command -v docker-compose &> /dev/null; then
    echo "[오류] Docker Compose가 설치되어 있지 않습니다."
    exit 1
fi

echo "[1/2] 컨테이너 중지 중..."
docker-compose stop
if [ $? -ne 0 ]; then
    echo "[오류] 컨테이너 중지에 실패했습니다."
    exit 1
fi

echo ""
echo "[2/2] 컨테이너 삭제 중..."
docker-compose down
if [ $? -ne 0 ]; then
    echo "[오류] 컨테이너 삭제에 실패했습니다."
    exit 1
fi

echo ""
echo "================================"
echo "서버가 성공적으로 중지되었습니다."
echo "================================"
echo ""

