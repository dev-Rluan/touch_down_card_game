const { createRateLimiter, cleanupSocket, limiters } = require('../../utils/socketRateLimiter');

describe('createRateLimiter', () => {
  let limiter;

  afterEach(() => {
    limiter.destroy();
  });

  test('윈도우 내 maxRequests 횟수까지 허용한다', () => {
    limiter = createRateLimiter({ maxRequests: 3, windowMs: 1000 });
    expect(limiter.allow('s1')).toBe(true);
    expect(limiter.allow('s1')).toBe(true);
    expect(limiter.allow('s1')).toBe(true);
  });

  test('maxRequests 초과 시 차단한다', () => {
    limiter = createRateLimiter({ maxRequests: 3, windowMs: 1000 });
    limiter.allow('s1');
    limiter.allow('s1');
    limiter.allow('s1');
    expect(limiter.allow('s1')).toBe(false);
  });

  test('소켓이 다르면 독립적으로 카운트한다', () => {
    limiter = createRateLimiter({ maxRequests: 1, windowMs: 1000 });
    expect(limiter.allow('s1')).toBe(true);
    expect(limiter.allow('s2')).toBe(true);
    expect(limiter.allow('s1')).toBe(false);
    expect(limiter.allow('s2')).toBe(false);
  });

  test('reset 후 다시 허용한다', () => {
    limiter = createRateLimiter({ maxRequests: 1, windowMs: 1000 });
    limiter.allow('s1');
    expect(limiter.allow('s1')).toBe(false);
    limiter.reset('s1');
    expect(limiter.allow('s1')).toBe(true);
  });

  test('윈도우가 만료되면 다시 허용한다', async () => {
    limiter = createRateLimiter({ maxRequests: 1, windowMs: 50 });
    limiter.allow('s1');
    expect(limiter.allow('s1')).toBe(false);
    await new Promise(r => setTimeout(r, 60));
    expect(limiter.allow('s1')).toBe(true);
  });
});

describe('cleanupSocket', () => {
  test('모든 limiter에서 해당 소켓을 정리한다', () => {
    // halliGalli limiter를 꽉 채운다
    const maxReq = 3;
    for (let i = 0; i < maxReq; i++) {
      limiters.halliGalli.allow('cleanup-test');
    }
    expect(limiters.halliGalli.allow('cleanup-test')).toBe(false);

    cleanupSocket('cleanup-test');

    // 정리 후 다시 허용돼야 한다
    expect(limiters.halliGalli.allow('cleanup-test')).toBe(true);
  });
});
