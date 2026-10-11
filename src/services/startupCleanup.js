// 서버 시작 시 이전 프로세스가 남긴 런타임 상태(방/접속 유저) 정리
// 소켓 연결은 프로세스와 함께 사라지므로 남은 방/유저 키는 모두 유령 데이터다.
// 서버를 여러 인스턴스로 운영한다면 RESET_STATE_ON_BOOT=false 로 끄고 별도로 관리한다.
const { ensureRedisConnection } = require('../config/redisClient');

const PATTERNS = ['user:*', 'room:data:*'];
const FIXED_KEYS = ['rooms:waiting', 'rooms:name:index'];

async function resetRuntimeState() {
  if (process.env.RESET_STATE_ON_BOOT === 'false') return 0;

  const redis = await ensureRedisConnection();
  let removed = 0;

  for (const pattern of PATTERNS) {
    for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 200 })) {
      // node-redis v5 의 scanIterator 는 키 배열을 반환할 수 있다
      const keys = Array.isArray(key) ? key : [key];
      if (keys.length > 0) {
        removed += await redis.del(keys);
      }
    }
  }
  removed += await redis.del(FIXED_KEYS);

  console.log(`[Startup] 이전 런타임 상태 정리 완료 (키 ${removed}개 삭제)`);
  return removed;
}

module.exports = { resetRuntimeState };
