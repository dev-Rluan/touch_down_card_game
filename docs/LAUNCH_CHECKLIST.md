# 오픈 체크리스트

## 필수 환경변수 (운영)
- `NODE_ENV=production`
- `REDIS_URL` (또는 `REDIS_HOST/PORT/PASSWORD`, TLS 사용 시 `REDIS_TLS=true`)
- `PORT` (호스팅 기본값 사용 가능)
- 프런트와 서버를 **같은 도메인**으로 서비스하면 `SOCKET_ALLOW_ORIGINS`/`CLIENT_SOCKET_SERVER_URL` 은 비워둡니다.
  도메인을 분리한다면 `SOCKET_ALLOW_ORIGINS` 에 프런트 origin 을 반드시 지정하세요
  (운영에서 미설정 시 동일 출처만 허용).

## 이번 버전 동작
- 로그인/랭킹/업적/상점은 `ENABLE_ACCOUNTS=false`(기본)로 비활성. `/auth`, `/api` 는 404.
- 접속 시 서버가 임시 닉네임(예: `빠른여우42`)을 부여, 12자 이하로 변경 가능.
- 색 테마 4종(딥그린/미드나잇/와인/차콜) — 브라우저 localStorage 에 저장.

## 배포 전 확인
- [ ] `npm test` 전체 통과
- [ ] `npm run build` (React 빌드 → `src/public/dist`), Docker 는 멀티스테이지로 자동 빌드
- [ ] `GET /healthz` 가 `{"status":"ok"}` (Redis 연결 포함) — Docker HEALTHCHECK 가 사용
- [ ] Redis 영속성/메모리 설정 확인 (방/유저 데이터는 재시작 시 정리됨)
- [ ] 2~4명이 실제 모바일 기기로 한 판 완주 (방 생성 → 준비 → 플레이 → 결과 → 다시 하기)

## 알려진 한계 / 후속 과제
- 방 최대 인원은 UI 에서 4명까지 선택 가능.
- `npm audit` 잔여 3건(moderate)은 로그인 모듈(`passport-oauth2`)과 `uuid` — breaking 업데이트 필요,
  계정 기능을 다시 켜기 전에 처리.
- AdSense: `env.js` 로 게시자 ID/슬롯은 전달되지만 `adsbygoogle.js` 스크립트 로드 코드는 없음 (광고 도입 시 추가).
- 예전 바닐라 JS 화면(`src/public/js`, `src/view`)은 빌드 결과가 없을 때만 쓰이는 레거시.
- 소켓 이벤트 `halliGalli` 등 내부 이름은 그대로 (사용자 노출 없음).
