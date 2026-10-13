const latency = require('../../utils/latency');

afterEach(() => latency._stats.clear());

describe('latency', () => {
  test('표본으로 평활 RTT·최솟값·흔들림을 계산한다', () => {
    [100, 100, 100, 100].forEach(v => latency.record('s1', v));
    expect(latency.getLatency('s1')).toEqual({ rtt: 100, min: 100, jitter: 0, samples: 4 });
    latency.record('s1', 300); // 튄 값은 평활값을 일부만 움직인다
    const l = latency.getLatency('s1');
    expect(l.rtt).toBe(150);
    expect(l.min).toBe(100);
    expect(l.jitter).toBeGreaterThan(0);
  });

  test('최근 10개만 보관하고 표본이 없으면 null', () => {
    for (let i = 0; i < 15; i++) latency.record('s2', 50 + i);
    expect(latency.getLatency('s2').samples).toBe(10);
    expect(latency.getLatency('s2').min).toBe(55);
    expect(latency.getLatency('nobody')).toBeNull();
  });

  test('startProbe: 연결 즉시 측정하고, ack 가 오면 기록, 끊기면 정리', () => {
    jest.useFakeTimers();
    const handlers = {};
    let pending = null;
    const socket = {
      id: 'p1', connected: true,
      on: (ev, fn) => { handlers[ev] = fn; },
      timeout: () => ({ emit: (ev, ts, cb) => { expect(ev).toBe('latencyPing'); pending = cb; } }),
    };
    latency.startProbe(socket);
    expect(pending).not.toBeNull();
    pending(null); // 바로 응답
    expect(latency.getLatency('p1').samples).toBe(1);

    pending = null;
    jest.advanceTimersByTime(latency.PROBE_INTERVAL_MS);
    expect(pending).not.toBeNull(); // 주기적으로 다시 측정
    pending(new Error('timeout'));
    expect(latency.getLatency('p1').samples).toBe(1); // 시간 초과는 표본이 아님

    handlers.disconnect();
    expect(latency.getLatency('p1')).toBeNull();
    pending = null;
    jest.advanceTimersByTime(latency.PROBE_INTERVAL_MS * 2);
    expect(pending).toBeNull(); // 끊긴 뒤에는 측정하지 않음
    jest.useRealTimers();
  });

  test('summary: 현재 접속자 분포와 누적 구간 개수', () => {
    latency.record('a', 20); latency.record('b', 120); latency.record('c', 500);
    const s = latency.summary();
    expect(s.connected).toBe(3);
    expect(s.current.p50).toBe(120);
    expect(s.current.max).toBe(500);
    expect(s.sinceStart.buckets.find(b => b.upTo === 30).count).toBeGreaterThan(0);
    expect(s.sinceStart.buckets.at(-1)).toMatchObject({ upTo: null });
  });
});
