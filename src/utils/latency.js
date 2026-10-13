// 플레이어별 네트워크 지연 측정 (벨 시간 보정 1단계: 측정·표시)
//
// 서버가 주기적으로 latencyPing 을 보내고 클라이언트가 바로 ack 하면 그 왕복 시간(RTT)을 잰다.
// 서버가 직접 재므로 클라이언트가 값을 꾸며 보낼 수 없다 (일부러 늦게 ack 해 RTT 를 부풀리는 것은 가능하므로,
// 2단계에서 보정에 쓸 때는 상한을 둔다).
//
// 기록: 소켓별 최근 10개 표본 → 평활값(EWMA), 최솟값, 흔들림(jitter)
// 통계: 서버 시작 이후 모든 표본의 구간별 개수 (/admin/latency 에서 확인)
const { performance } = require('perf_hooks');

const PROBE_INTERVAL_MS = 3000;
const PROBE_TIMEOUT_MS = 2000;
const MAX_SAMPLES = 10;
const EWMA_ALPHA = 0.25;
const BUCKETS = [30, 60, 100, 150, 250, 400, Infinity]; // 이하(ms)

const stats = new Map(); // socketId -> { samples, ewma, jitter, timeouts, updatedAt }
const histogram = BUCKETS.map(() => 0);
let totalSamples = 0;
let totalTimeouts = 0;

function record(socketId, rtt) {
  let s = stats.get(socketId);
  if (!s) {
    s = { samples: [], ewma: rtt, jitter: 0, timeouts: 0, updatedAt: 0 };
    stats.set(socketId, s);
  }
  s.samples.push(rtt);
  if (s.samples.length > MAX_SAMPLES) s.samples.shift();
  s.jitter = s.jitter + EWMA_ALPHA * (Math.abs(rtt - s.ewma) - s.jitter);
  s.ewma = s.ewma + EWMA_ALPHA * (rtt - s.ewma);
  s.updatedAt = Date.now();

  histogram[BUCKETS.findIndex(limit => rtt <= limit)]++;
  totalSamples++;
}

function recordTimeout(socketId) {
  const s = stats.get(socketId);
  if (s) s.timeouts++;
  totalTimeouts++;
}

/**
 * @returns {{rtt: number, min: number, jitter: number, samples: number}|null} 반올림한 ms 값, 아직 표본이 없으면 null
 */
function getLatency(socketId) {
  const s = stats.get(socketId);
  if (!s || s.samples.length === 0) return null;
  return {
    rtt: Math.round(s.ewma),
    min: Math.round(Math.min(...s.samples)),
    jitter: Math.round(s.jitter),
    samples: s.samples.length,
  };
}

/** 소켓 연결 시 호출: 바로 1회 + 이후 주기적으로 측정. 연결이 끊기면 스스로 정리된다 */
function startProbe(socket) {
  const probe = () => {
    if (!socket.connected) return;
    const t0 = performance.now();
    socket.timeout(PROBE_TIMEOUT_MS).emit('latencyPing', Date.now(), (err) => {
      if (err) recordTimeout(socket.id);
      else record(socket.id, performance.now() - t0);
    });
  };
  probe();
  const timer = setInterval(probe, PROBE_INTERVAL_MS);
  if (timer.unref) timer.unref();
  socket.on('disconnect', () => {
    clearInterval(timer);
    stats.delete(socket.id);
  });
}

/** 운영자 페이지용 요약 */
function summary() {
  const current = [...stats.values()].filter(s => s.samples.length > 0).map(s => s.ewma).sort((a, b) => a - b);
  const pct = p => (current.length ? Math.round(current[Math.min(current.length - 1, Math.floor(p * current.length))]) : null);
  return {
    connected: current.length,
    current: { p50: pct(0.5), p90: pct(0.9), max: current.length ? Math.round(current[current.length - 1]) : null },
    sinceStart: {
      samples: totalSamples,
      timeouts: totalTimeouts,
      buckets: BUCKETS.map((limit, i) => ({ upTo: limit === Infinity ? null : limit, count: histogram[i] })),
    },
  };
}

module.exports = { startProbe, getLatency, summary, record, PROBE_INTERVAL_MS, _stats: stats };
