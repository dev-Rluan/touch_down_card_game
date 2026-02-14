# Socket.IO 배포 및 환경 변수 가이드

## 1. 서버 구성 개요
- **백엔드**: `src/server.js`에서 Express + Socket.IO + Redis를 한 프로세스로 실행합니다. Redis 접속이 성공해야 서버가 기동합니다 (`ensureRedisConnection`).
- **프런트엔드**: 정적 자산(`src/view`, `src/public`)을 어디든 배포할 수 있으며, 클라이언트는 환경 변수를 통해 적절한 Socket 서버 URL로 연결합니다.
- **권장 구성**: 정적 프런트(Vercel 등) + 별도 Node 서버(Render/Railway/EC2 등) + Redis(Managed/자체 호스트).

## 2. 환경 변수 일람
| 변수 | 설명 | 예시 |
|------|------|------|
| `REDIS_URL` / `REDIS_HOST` 등 | Redis 접속 정보 | `redis://user:pass@host:6379/0` |
| `SOCKET_SERVER_URL` (또는 `CLIENT_SOCKET_SERVER_URL`) | 프런트가 사용할 Socket.IO 서버 URL. 클라이언트에서 `/env.js`로 노출됨 | `https://socket-api.example.com` |
| `SOCKET_ALLOW_ORIGINS` | Socket.IO/Express에서 허용할 Origin 목록(콤마 구분). 미지정 시 임시로 `*` 허용 | `https://touch-down-card-game.vercel.app,https://admin.example.com` |

## 3. 클라이언트 설정 흐름
1. 서버 실행 시 `/env.js`가 생성되어 `window.__TOUCHDOWN_SOCKET_URL__`에 `SOCKET_SERVER_URL` 값을 주입합니다.
2. `src/public/js/config.js`가 해당 값을 최우선으로 사용하여 Socket.IO 엔드포인트를 결정합니다.
3. 값이 비어 있으면 `window.location.origin`을 fallback으로 사용하므로, 프런트와 백엔드가 같은 도메인일 때는 별도 설정이 필요 없습니다.

## 4. CORS 및 Socket.IO 허용 도메인
- Express와 Socket.IO 모두 `SOCKET_ALLOW_ORIGINS` 환경 변수(콤마 구분)를 읽어서 허용 Origin을 결정합니다.
- 예시:
  ```bash
  SOCKET_ALLOW_ORIGINS="https://touch-down-card-game.vercel.app,https://dashboard.example.com"
  ```
- 설정하지 않으면 개발 편의를 위해 `*`를 허용하지만, 프로덕션에서는 반드시 도메인을 명시해주세요.

## 5. 배포 시퀀스 예시
1. **Redis 준비**: Managed Redis(Upstash, Redis Cloud 등) 혹은 자체 호스트.
2. **Socket 서버 배포**: Render/Railway/EC2 등에서 `npm install && npm run start` 실행. 환경 변수(`REDIS_URL`, `SOCKET_ALLOW_ORIGINS`) 지정.
3. **프런트 배포**: Vercel 등 정적 호스트에 `dist` 또는 `src/view`/`src/public` 자산 업로드. `SOCKET_SERVER_URL`을 해당 백엔드 주소로 설정.
4. **검증**:
   - 백엔드 로그에서 `[Server]` 메시지 확인 (Redis 연결 성공 여부 포함).
   - 프런트 브라우저 콘솔에서 `ClientConfig.serverUrl`이 올바른 주소인지 확인.
   - `curl https://<frontend>/socket.io/?EIO=4&transport=polling` 요청 시 CORS 200 응답인지 확인.

## 6. 문제 해결 체크리스트
- Socket.IO가 400/404를 반환하면:
  - 백엔드 프로세스가 실제로 떠 있는지 확인 (`npm run dev` 로그, 포트 확인 등).
  - `SOCKET_SERVER_URL`이 프런트에 주입되었는지 `/env.js`에서 확인.
  - `SOCKET_ALLOW_ORIGINS`에 프런트 도메인을 포함했는지 확인.
- Redis 연결 실패 시 서버가 바로 종료되므로, 배포 환경에서 Redis 인증/네트워크 구성이 맞는지 재검토하세요.

## 7. 추가 참고
- 실시간 트래픽이 늘어날 경우 Socket.IO Redis 어댑터로 여러 인스턴스를 수평확장할 수 있습니다 (현재는 단일 서버 기준 구현).
- 정적 프런트를 Vercel에 유지하면서 백엔드를 별도 호스트에 두는 구성이 운영·확장 측면에서 가장 유연합니다.
