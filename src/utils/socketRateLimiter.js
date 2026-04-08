/**
 * 소켓 이벤트별 Rate Limiter
 * 슬라이딩 윈도우 방식으로 클라이언트당 이벤트 호출 횟수를 제한한다.
 *
 * 사용 예)
 *   const limiter = createRateLimiter({ maxRequests: 5, windowMs: 1000 });
 *   if (!limiter.allow(socket.id)) {
 *     socket.emit('error', '너무 빠릅니다.');
 *     return;
 *   }
 */

/**
 * @typedef {Object} RateLimiterOptions
 * @property {number} maxRequests  - 윈도우 내 최대 허용 횟수
 * @property {number} windowMs     - 윈도우 크기 (밀리초)
 */

/**
 * @typedef {Object} RateLimiter
 * @property {function(string): boolean} allow  - 요청 허용 여부 반환
 * @property {function(string): void}   reset   - 특정 소켓의 카운터 초기화
 * @property {function(): void}         destroy - 내부 정리 타이머 중단
 */

/**
 * Rate Limiter 생성
 * @param {RateLimiterOptions} options
 * @returns {RateLimiter}
 */
function createRateLimiter({ maxRequests, windowMs }) {
  // socketId -> { count, resetAt }
  const store = new Map();

  // 만료된 항목을 주기적으로 정리 (메모리 누수 방지)
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
  }, windowMs * 2);

  // 테스트 환경에서 process 종료가 지연되지 않도록 unref
  if (cleanupInterval.unref) cleanupInterval.unref();

  return {
    /**
     * 해당 소켓 ID의 요청을 허용할지 판단한다.
     * @param {string} socketId
     * @returns {boolean} true → 허용, false → 차단
     */
    allow(socketId) {
      const now = Date.now();
      const entry = store.get(socketId);

      if (!entry || now >= entry.resetAt) {
        store.set(socketId, { count: 1, resetAt: now + windowMs });
        return true;
      }

      if (entry.count < maxRequests) {
        entry.count++;
        return true;
      }

      return false;
    },

    /**
     * 특정 소켓의 카운터를 초기화한다 (연결 해제 시 호출 권장).
     * @param {string} socketId
     */
    reset(socketId) {
      store.delete(socketId);
    },

    /**
     * 정리 타이머를 중단한다 (테스트 또는 서버 종료 시 사용).
     */
    destroy() {
      clearInterval(cleanupInterval);
    },
  };
}

// ── 이벤트별 limiter 인스턴스 ────────────────────────────────────────────────

const limiters = {
  // 벨 클릭: 1초에 최대 3회 (실제 게임에서 충분한 여유)
  halliGalli: createRateLimiter({ maxRequests: 3, windowMs: 1000 }),

  // 카드 내기: 1초에 최대 5회 (네트워크 지연 고려)
  playCard: createRateLimiter({ maxRequests: 5, windowMs: 1000 }),

  // 준비 상태 토글: 2초에 최대 5회
  ready: createRateLimiter({ maxRequests: 5, windowMs: 2000 }),

  // 방 생성/입장: 5초에 최대 5회 (연속 방 생성 스팸 방지)
  roomAction: createRateLimiter({ maxRequests: 5, windowMs: 5000 }),

  // 이름 변경: 5초에 최대 3회
  changeName: createRateLimiter({ maxRequests: 3, windowMs: 5000 }),
};

/**
 * 소켓 연결 해제 시 모든 limiter에서 해당 소켓 정보를 정리한다.
 * @param {string} socketId
 */
function cleanupSocket(socketId) {
  Object.values(limiters).forEach(limiter => limiter.reset(socketId));
}

module.exports = { limiters, cleanupSocket, createRateLimiter };
