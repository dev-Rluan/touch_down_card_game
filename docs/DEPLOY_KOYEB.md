# Koyeb 배포 순서 (Cloudflare 도메인 + Upstash Redis)

> 호스팅 서비스의 화면/요금/지역은 자주 바뀝니다. 아래는 구조와 순서이며, 세부 항목은 각 대시보드 안내를 우선하세요.

## 0. 준비
- [ ] 배포할 브랜치(`main`)에 최신 코드가 머지되어 있어야 합니다 (Koyeb 이 GitHub 의 해당 브랜치를 빌드).
- [ ] 서브도메인 이름 결정 (예: `play.rluan.dev`) — 오래 쓸 이름으로.

## 1. Redis 만들기 (Koyeb 에는 Redis 가 없으므로 외부 서비스 사용, 예: Upstash)
1. Redis 데이터베이스 생성. **리전은 Koyeb 서비스 리전과 같은 곳**으로 고르세요.
   카드 한 장을 낼 때 Redis 를 약 10번 순차 호출하므로, 리전이 다르면 지연이 그대로 곱해집니다.
2. 접속 정보를 `rediss://default:<비밀번호>@<호스트>:<포트>` 형태의 TLS URL 로 준비합니다.
   (`rediss://` 이면 TLS 가 자동 적용됩니다)
3. **무료 한도 주의**: 월 명령 수 제한(예: 50만)이 있습니다. 게임 1판에 수백 개 명령이 쓰이므로
   무료 한도는 오픈 초기 소규모 테스트용이고, 사용자가 늘면 종량제로 바꾸세요.
   (헬스체크의 Redis PING 은 15초 캐시되어 한도를 거의 쓰지 않습니다.)

## 2. Koyeb 서비스 생성
1. Koyeb → Create service → **GitHub** 저장소 선택 → 브랜치 `main`.
2. Builder: **Dockerfile** (저장소 루트의 `Dockerfile`, React 빌드까지 멀티스테이지로 자동 수행).
3. Instance: 지역을 **사용자와 가까운 곳**으로. 무료 인스턴스는 지역이 제한되고(프랑크푸르트/워싱턴 등),
   1시간 무트래픽이면 잠들었다가 첫 접속에서 수 초 지연이 있습니다. 한국 사용자 대상 실서비스라면
   유료 인스턴스에서 아시아 지역이 있는지 확인하세요.
4. **Scaling: 최소 1 / 최대 1 인스턴스 고정** — 이 앱은 단일 인스턴스 전제입니다.
   가능하면 scale-to-zero 는 끄세요 (잠들면 WebSocket 접속이 끊깁니다).
5. **Exposed port: 3000 (HTTP)**.
6. **Health check: HTTP, 경로 `/healthz`, 포트 3000**.
7. 환경변수:
   | 이름 | 값 |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `3000` |
   | `REDIS_URL` | 1단계의 `rediss://...` (**Secret** 으로 등록) |
   - 그 외(`ENABLE_ACCOUNTS`, `RESET_STATE_ON_BOOT`, CORS 관련)는 기본값 그대로 두면 됩니다.
   - 광고는 나중에 `ADSENSE_*` 를 추가 (`docs/ADS_SETUP.md`).
8. Deploy → 로그에서 `[Startup] ... 정리 완료`, `서버가 3000번 포트에서 시작되었습니다` 확인.
9. `https://<앱이름>.koyeb.app/healthz` 가 `{"status":"ok"}` 인지 확인.

## 3. 도메인 연결 (Cloudflare DNS)
1. Koyeb → Domains(또는 서비스의 Settings) → 도메인 추가: `play.rluan.dev` 를 해당 앱에 연결.
   Koyeb 이 **CNAME 대상 값**을 알려줍니다 (이 값을 그대로 복사).
2. Cloudflare 대시보드 → `rluan.dev` → DNS → Records → Add record
   - Type: `CNAME`, Name: `play`, Target: Koyeb 이 알려준 값
   - **Proxy status: "DNS only"(회색 구름)** 로 시작하세요. Koyeb 이 인증서를 발급/검증하려면
     DNS 가 Koyeb 으로 바로 연결되어야 합니다.
3. Koyeb 도메인 상태가 인증서 발급 완료(Active)가 될 때까지 대기 (수 분~).
   막히면 CNAME 값 오타, 이미 같은 이름의 다른 레코드(A/AAAA 등) 존재, `CAA` 레코드가 인증서 발급을 막는 경우를 확인하세요.
4. `https://play.rluan.dev` 접속 확인.
5. (선택) Cloudflare 프록시(주황 구름)를 켜고 싶다면, 위가 모두 정상인 뒤에 켜고
   SSL/TLS 모드는 **Full (strict)** 으로 두세요. 프록시를 켠 뒤에는 **WebSocket 이 끊기지 않는지**
   (5분 이상 방에 머물기) 반드시 확인하세요. 필요가 없다면 DNS only 로 두는 것이 단순하고 안전합니다.

## 4. 배포 후 확인
- [ ] 스마트폰 2~4대로 방 생성 → 준비 → 한 판 완주 → 결과 → 다시 하기
- [ ] 방에서 5분 이상 대기해도 연결이 유지되는지
- [ ] 브라우저 개발자도구 Network 에서 외부 호스트 요청이 없는지 (광고를 켜기 전까지)
- [ ] Koyeb 로그에 에러가 없는지, `/healthz` 가 200 인지

## 5. 운영 메모
- **재배포하면 진행 중인 방은 모두 사라집니다** (시작 시 방/접속자 정리). 사용자가 적은 시간대에 배포하세요.
- 서버를 여러 대로 늘리려면 Socket.IO Redis 어댑터, 스티키 세션, Redis 락이 먼저 필요합니다.
- 도메인을 나중에 바꿔도 코드 수정은 필요 없습니다 (DNS/Koyeb 도메인 설정만 변경, 옛 주소는 리다이렉트).
