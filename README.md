# 🎮 Touch Down Card Game

온라인 할리갈리 멀티플레이어 게임

## 🚀 빠른 시작

### 설치 및 실행
```bash
# 저장소 클론
git clone https://github.com/dev-Rluan/touch_down_card_game.git
cd touch_down_card_game

# 의존성 설치
npm install

# 개발 서버 시작
npm run dev
```

### 접속
- **서버**: http://localhost:3000
- **개발자 도구**: F12로 Socket.IO 연결 확인

## 🎯 주요 기능

### 게임 기능
- **실시간 멀티플레이어**: 최대 8명까지 동시 플레이
- **할리갈리 게임**: 같은 색의 모양의 합이 특정 숫자가 되었을 때 종을 치면 카드 획득
- **방 관리**: 방 생성, 입장, 나가기
- **실시간 채팅**: 게임 중 채팅 기능

### 기술 스택
- **백엔드**: Node.js + Express + Socket.IO
- **프론트엔드**: HTML5 + CSS3 + JavaScript + Bootstrap
- **통신**: WebSocket 기반 실시간 통신

## 📚 문서

- [📖 API 통신 규격](./docs/API_통신_규격_문서.md) - Socket.IO 이벤트 명세
- [📋 소프트웨어 스펙](./docs/소프트웨어_스펙_문서.md) - 전체 시스템 스펙
- [🛠️ 개발 가이드](./docs/개발가이드.md) - 개발 환경 설정 및 가이드
- [🤝 기여 가이드](./docs/CONTRIBUTING.md) - 기여 방법
- [📝 코딩 스타일](./docs/CODING_STYLE.md) - 코드 스타일 가이드
- [🚀 배포 가이드](./docs/DEPLOYMENT.md) - 배포 방법

## 🏗️ 프로젝트 구조

```
src/
├── server.js              # 메인 서버 파일
├── services/              # 비즈니스 로직
│   ├── roomService.js     # 방 관리 서비스
│   ├── userServices.js   # 사용자 관리 서비스
│   └── gameService.js     # 게임 로직 서비스
├── controllers/           # 컨트롤러
├── models/               # 데이터 모델
├── socket/               # Socket.IO 이벤트
├── public/               # 정적 파일
│   ├── js/app.js         # 클라이언트 JavaScript
│   └── css/              # 스타일시트
└── view/                 # HTML 템플릿
```

## 🛠️ 개발

### 스크립트 명령어
```bash
npm run dev      # 개발 서버 시작 (nodemon)
npm start        # 프로덕션 서버 시작
npm test         # 테스트 실행
npm run lint     # 코드 린팅
npm run build    # 빌드
npm run docs     # 문서 생성
```

### 환경 설정
```bash
# .env 파일 생성
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
```

## 🧪 테스트

### 테스트 실행
```bash
# 모든 테스트 실행
npm test

# 특정 테스트 실행
npm test -- --testNamePattern="roomService"

# 커버리지 포함
npm test -- --coverage
```

### 테스트 구조
```
src/tests/
├── unit/              # 단위 테스트
├── integration/       # 통합 테스트
└── e2e/              # E2E 테스트
```

## 🚀 배포

### Docker 배포
```bash
# Docker 이미지 빌드
docker build -t touch-down-game .

# 컨테이너 실행
docker run -d -p 3000:3000 --name touch-down-game touch-down-game
```

### 클라우드 배포
- **AWS EC2**: [배포 가이드](./docs/DEPLOYMENT.md#aws-ec2-배포)
- **Heroku**: [배포 가이드](./docs/DEPLOYMENT.md#heroku-배포)
- **Vercel**: [배포 가이드](./docs/DEPLOYMENT.md#vercel-배포)

## 🤝 기여하기

1. **Fork** 저장소
2. **브랜치 생성** (`git checkout -b feature/새로운기능`)
3. **커밋** (`git commit -m 'feat: 새로운 기능 추가'`)
4. **Push** (`git push origin feature/새로운기능`)
5. **Pull Request** 생성

자세한 내용은 [기여 가이드](./docs/CONTRIBUTING.md)를 참고하세요.

## 📊 성능

- **동시 연결**: 최대 1000명
- **방당 최대 인원**: 8명
- **응답 시간**: 평균 50ms 이하
- **메모리 사용량**: 평균 100MB 이하

## 🔒 보안

- **입력값 검증**: 모든 사용자 입력 검증
- **에러 처리**: 적절한 에러 메시지 및 상태 코드
- **메모리 관리**: 사용자 연결 해제 시 적절한 정리
- **Rate Limiting**: API 호출 제한

## 📈 모니터링

### 로그 확인
```bash
# 실시간 로그
tail -f logs/combined.log

# 에러 로그
tail -f logs/error.log
```

### 헬스체크
```bash
# 서버 상태 확인
curl http://localhost:3000/health
```

## 🐛 문제 해결

### 자주 발생하는 문제들

#### 연결 문제
- 포트 3000이 사용 중인지 확인
- 방화벽 설정 확인
- Socket.IO 연결 상태 확인

#### 방 관리 문제
- 방 이름 중복 확인
- 최대 인원수 설정 확인
- 사용자 상태 확인

#### 메모리 누수
- 연결 해제 시 정리 로직 확인
- 불필요한 이벤트 리스너 제거
- 가비지 컬렉션 모니터링

## 📞 지원

- **이슈 리포트**: [GitHub Issues](https://github.com/dev-Rluan/touch_down_card_game/issues)
- **문의**: 프로젝트 관리자에게 직접 문의
- **토론**: [GitHub Discussions](https://github.com/dev-Rluan/touch_down_card_game/discussions)

## 📄 라이선스

이 프로젝트는 [ISC 라이선스](LICENSE) 하에 배포됩니다.

## 🙏 감사의 말

- **Socket.IO**: 실시간 통신을 위한 훌륭한 라이브러리
- **Express.js**: 빠르고 간단한 웹 프레임워크
- **Bootstrap**: 반응형 UI를 위한 CSS 프레임워크
- **모든 기여자들**: 프로젝트 개선에 기여해주신 모든 분들

---

**즐거운 게임 되세요! 🎮✨**