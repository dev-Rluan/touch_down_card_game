#!/bin/bash
# Touch Down Card Game - Docker 실행 스크립트
# Linux/Mac 사용자를 위한 간단한 실행 스크립트

echo "================================"
echo "Touch Down Card Game"
echo "Docker 실행 스크립트"
echo "================================"
echo ""

# Docker 설치 확인
if ! command -v docker &> /dev/null; then
    echo "[오류] Docker가 설치되어 있지 않습니다."
    echo "Docker를 설치해주세요: https://docs.docker.com/get-docker/"
    exit 1
fi

# Docker Compose 설치 확인
if ! command -v docker-compose &> /dev/null; then
    echo "[오류] Docker Compose가 설치되어 있지 않습니다."
    echo "Docker Compose를 설치해주세요: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "[1/3] Docker 이미지 빌드 중..."
docker-compose build
if [ $? -ne 0 ]; then
    echo "[오류] Docker 이미지 빌드에 실패했습니다."
    exit 1
fi

echo ""
echo "[2/3] 컨테이너 실행 중..."
docker-compose up -d
if [ $? -ne 0 ]; then
    echo "[오류] 컨테이너 실행에 실패했습니다."
    exit 1
fi

echo ""
echo "[3/3] 컨테이너 상태 확인 중..."
sleep 3
docker-compose ps

echo ""
echo "================================"
echo "서버가 성공적으로 시작되었습니다!"
echo "접속 URL: http://localhost:3000"
echo "================================"
echo ""
echo "로그 확인: docker-compose logs -f"
echo "중지: docker-compose down"
echo ""

# 브라우저 자동 실행 (선택사항)
read -p "브라우저를 자동으로 열까요? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # OS별 브라우저 열기
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open http://localhost:3000
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        open http://localhost:3000
    fi
fi

