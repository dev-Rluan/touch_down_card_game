@echo off
REM Touch Down Card Game - Docker 실행 스크립트
REM Windows 사용자를 위한 간단한 실행 스크립트

echo ================================
echo Touch Down Card Game
echo Docker 실행 스크립트
echo ================================
echo.

REM Docker 설치 확인
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Docker가 설치되어 있지 않습니다.
    echo Docker Desktop을 설치해주세요: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

REM Docker Compose 설치 확인
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Docker Compose가 설치되어 있지 않습니다.
    pause
    exit /b 1
)

echo [1/3] Docker 이미지 빌드 중...
docker-compose build
if %errorlevel% neq 0 (
    echo [오류] Docker 이미지 빌드에 실패했습니다.
    pause
    exit /b 1
)

echo.
echo [2/3] 컨테이너 실행 중...
docker-compose up -d
if %errorlevel% neq 0 (
    echo [오류] 컨테이너 실행에 실패했습니다.
    pause
    exit /b 1
)

echo.
echo [3/3] 컨테이너 상태 확인 중...
timeout /t 3 /nobreak >nul
docker-compose ps

echo.
echo ================================
echo 서버가 성공적으로 시작되었습니다!
echo 접속 URL: http://localhost:3000
echo ================================
echo.
echo 로그 확인: docker-compose logs -f
echo 중지: docker-compose down
echo.

REM 브라우저 자동 실행 (선택사항)
set /p OPEN_BROWSER="브라우저를 자동으로 열까요? (Y/N): "
if /i "%OPEN_BROWSER%"=="Y" (
    start http://localhost:3000
)

pause

