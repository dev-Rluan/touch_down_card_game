# Redis 기반 아키텍처 가이드

## 1. 개요
- 모든 방/사용자/게임 상태는 Redis에 저장되며 Node.js 인스턴스는 완전히 스테이트리스하게 동작합니다.
- 기본 접속 문자열은 `REDIS_URL` 환경변수로 제어하며, 미지정 시 `REDIS_HOST/REDIS_PORT/REDIS_DB/REDIS_USERNAME/REDIS_PASSWORD/REDIS_TLS` 값으로 URL이 자동 구성됩니다.
- Socket.IO 서버는 Redis를 통해 공유 상태를 읽고 갱신하고, 실시간 이벤트는 기존 방식대로 송신됩니다.

## 2. 로컬 개발 절차
1. **Redis 실행**
   - 로컬 설치: `redis-server --port 6379`
   - Docker: `docker run --name touch-down-redis -p 6379:6379 redis:7-alpine`
2. **환경 변수 설정**
   - `.env.example`를 `.env`로 복사 후 필요 시 `REDIS_URL` 또는 개별 호스트/포트/DB/자격 증명 변수를 수정
3. **의존성 설치 및 서버 실행**
   ```bash
   npm install
   npm run dev
   ```

## 3. 데이터 모델 요약
- `room:data:<roomId>`: 방 전체 정보(이름, 상태, 사용자 목록, gameState)를 JSON으로 저장
- `rooms:waiting`: 대기 중인 방 ID 집합 (Set)
- `rooms:name:index`: 방 이름 → roomId 해시, 중복 방 생성 차단용
- `user:<socketId>`: 사용자 닉네임/참여 방 ID를 Hash로 저장
- 게임 로직(`gameService`)은 방 객체의 `gameState` 필드를 갱신한 뒤 Redis에 다시 저장합니다.

## 4. 배포 시 고려 사항
- **환경 분리**: `REDIS_URL`만 바꾸면 동일 코드로 로컬/스테이징/프로덕션 모두 동작
- **고가용성**: Sentinel 또는 Redis Cluster를 앞단에 두고 애플리케이션에서는 가상 엔드포인트만 바라보도록 구성
- **모니터링**: `INFO`, slowlog, keyspace hit/miss, 메모리 사용량을 메트릭 수집 시스템으로 전송
- **백업/복구**: Replica의 RDB 스냅샷을 Object Storage로 주기 백업하고, 필요 시 AOF everysec를 활성화해 로그 복구

## 5. 마이그레이션 팁
- 기존 인메모리 상태는 제거되었으므로 서버 재시작 시에도 방/게임 정보가 유지됩니다.
- Socket 핸들러는 모두 `async/await` 기반으로 변경되었습니다. 새 기능 추가 시에도 동일 패턴으로 Redis 상태를 갱신하세요.
- Countdown, 타이머 등 실시간 요소는 여전히 프로세스 메모리에서 관리하지만 상태 결정은 Redis를 기준으로 재검증합니다.
