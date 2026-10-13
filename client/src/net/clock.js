// 서버 시계 맞추기 + 내 핑 측정 (벨 시간 보정 1단계)
//
// 3초마다 timeSync 를 보내 서버 시각(Ts)을 받는다.
//   RTT    = 받은 시각 − 보낸 시각
//   offset = Ts − (보낸 시각 + RTT/2)        → 서버 시각 ≈ Date.now() + offset
// 지연이 튄 측정은 오차가 크므로 최근 10개 중 RTT 가 가장 작은 측정의 offset 을 쓴다.
// 핑 표시는 최근 값들을 부드럽게(EWMA) 한 값.
const INTERVAL_MS = 3000;
const MAX_SAMPLES = 10;
const ALPHA = 0.3;

let samples = [];        // [{ rtt, offset }]
let ping = null;         // 표시용 평활 RTT (ms)
let offset = 0;          // 서버 시각 − 내 시각 (ms)
let timer = null;
const listeners = new Set();

function notify() {
  listeners.forEach(fn => fn(ping));
}

function measure(socket) {
  if (!socket.connected) return;
  const sentWall = Date.now();
  const sentMono = performance.now();
  socket.timeout(2000).emit('timeSync', (err, serverTs) => {
    if (err || typeof serverTs !== 'number') return;
    const rtt = performance.now() - sentMono;
    samples.push({ rtt, offset: serverTs - (sentWall + rtt / 2) });
    if (samples.length > MAX_SAMPLES) samples.shift();
    offset = samples.reduce((best, s) => (s.rtt < best.rtt ? s : best)).offset;
    ping = ping == null ? rtt : ping + ALPHA * (rtt - ping);
    notify();
  });
}

/** 소켓 연결 후 호출. 반환된 함수로 정리 */
export function startClockSync(socket) {
  // 서버가 재는 지연 측정에 바로 응답
  const onPing = (_ts, ack) => { if (typeof ack === 'function') ack(); };
  socket.on('latencyPing', onPing);

  const kick = () => {
    samples = [];
    measure(socket);
  };
  socket.on('connect', kick);
  if (socket.connected) kick();
  clearInterval(timer);
  timer = setInterval(() => measure(socket), INTERVAL_MS);

  return () => {
    clearInterval(timer);
    socket.off('latencyPing', onPing);
    socket.off('connect', kick);
  };
}

/** 내 왕복 지연(ms, 반올림). 아직 측정 전이면 null */
export function getPing() {
  return ping == null ? null : Math.round(ping);
}

/** 서버 시계 기준 현재 시각 (2단계: 벨 누른 시각 보고에 사용) */
export function serverNow() {
  return Date.now() + offset;
}

export function subscribePing(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
